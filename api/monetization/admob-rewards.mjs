import {
  createHmac,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";
import { MonetizationError } from "./errors.mjs";
import {
  addPendingReward,
  addRewardCredit,
  getRecord,
  getUsageStatus,
  premiumActive,
  usageForRecord,
  validateInstallationId,
} from "./usage-store.mjs";

const REWARD_TOKEN_TTL_MS = 10 * 60 * 1000;
const ADMOB_KEYS_URL =
  "https://www.gstatic.com/admob/reward/verifier-keys.json";
let admobKeysCache = { expiresAt: 0, keys: new Map() };

export function createRewardToken(installationId, nonce, expiresAt, accountUserId) {
  const secret = process.env.ADMOB_SSV_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new MonetizationError(
      "Serwer nie skonfigurował bezpiecznej weryfikacji reklam.",
      503,
      "REWARD_NOT_CONFIGURED",
    );
  }
  const payload = Buffer.from(
    JSON.stringify({
      installationId,
      nonce,
      expiresAt,
      ...(accountUserId ? { accountUserId } : {}),
    }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyRewardToken(customData) {
  const [payload, signature, extra] = String(customData ?? "").split(".");
  if (!payload || !signature || extra)
    throw new MonetizationError(
      "Nieprawidłowe dane nagrody.",
      400,
      "INVALID_REWARD_TOKEN",
    );
  const secret = process.env.ADMOB_SSV_TOKEN_SECRET;
  if (!secret || secret.length < 32)
    throw new MonetizationError(
      "Weryfikacja nagrody jest niedostępna.",
      503,
      "REWARD_NOT_CONFIGURED",
    );
  const expected = createHmac("sha256", secret).update(payload).digest();
  const provided = Buffer.from(signature, "base64url");
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    throw new MonetizationError(
      "Nieprawidłowy podpis nagrody.",
      400,
      "INVALID_REWARD_TOKEN",
    );
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new MonetizationError(
      "Nieprawidłowe dane nagrody.",
      400,
      "INVALID_REWARD_TOKEN",
    );
  }
  if (!data.installationId || !data.nonce || data.expiresAt < Date.now()) {
    throw new MonetizationError(
      "Wygasła prośba o nagrodę.",
      400,
      "REWARD_EXPIRED",
    );
  }
  return data;
}

export function startReward(installationId) {
  const id = validateInstallationId(installationId);
  const record = getRecord(id);
  if (premiumActive(record))
    throw new MonetizationError(
      "Premium nie wyświetla reklam z nagrodą.",
      403,
      "PREMIUM_NO_ADS",
    );
  if (usageForRecord(record).canRecognize)
    throw new MonetizationError(
      "Najpierw wykorzystaj dostępny limit rozpoznań.",
      409,
      "QUOTA_NOT_EXHAUSTED",
    );
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + REWARD_TOKEN_TTL_MS;
  addPendingReward(id, { nonce, expiresAt });
  return { customData: createRewardToken(id, nonce, expiresAt), userId: id };
}

export function claimDevelopmentReward(installationId, customData) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ALLOW_UNVERIFIED_AD_REWARDS !== "true"
  ) {
    throw new MonetizationError(
      "Nagrody można przyznawać wyłącznie po weryfikacji AdMob.",
      403,
      "SSV_REQUIRED",
    );
  }
  const token = verifyRewardToken(customData);
  if (
    validateInstallationId(installationId) !==
    validateInstallationId(token.installationId)
  ) {
    throw new MonetizationError(
      "Nagroda należy do innej instalacji.",
      403,
      "REWARD_OWNER_MISMATCH",
    );
  }
  addRewardCredit(token.installationId, token.nonce, `dev-${token.nonce}`);
  return getUsageStatus(installationId);
}

async function getAdmobKeys() {
  if (admobKeysCache.expiresAt > Date.now() && admobKeysCache.keys.size)
    return admobKeysCache.keys;
  const response = await fetch(ADMOB_KEYS_URL);
  if (!response.ok)
    throw new Error(`AdMob keys request failed: ${response.status}`);
  const body = await response.json();
  const keys = new Map(
    (body.keys ?? []).map((key) => [String(key.keyId), key.pem]),
  );
  if (!keys.size) throw new Error("AdMob did not return verification keys");
  admobKeysCache = { expiresAt: Date.now() + 23 * 60 * 60 * 1000, keys };
  return keys;
}

export async function verifyAdmobCallback(rawUrl) {
  const queryStart = rawUrl.indexOf("?");
  if (queryStart < 0)
    throw new MonetizationError(
      "Brak parametrów podpisu AdMob.",
      400,
      "INVALID_SSV",
    );
  const rawQuery = rawUrl.slice(queryStart + 1);
  const signatureIndex = rawQuery.indexOf("&signature=");
  if (signatureIndex < 0)
    throw new MonetizationError("Brak podpisu AdMob.", 400, "INVALID_SSV");
  const signedContent = rawQuery.slice(0, signatureIndex);
  const params = new URLSearchParams(rawQuery);
  const signatureParams = new URLSearchParams(rawQuery.slice(signatureIndex));
  const keyId = signatureParams.get("key_id");
  const signature = signatureParams.get("signature");
  const publicKey = (await getAdmobKeys()).get(keyId ?? "");
  if (!publicKey || !signature)
    throw new MonetizationError(
      "Nieznany klucz podpisu AdMob.",
      400,
      "INVALID_SSV",
    );

  const valid = verifySignature(
    "sha256",
    Buffer.from(signedContent, "utf8"),
    { key: publicKey, dsaEncoding: "der" },
    Buffer.from(signature, "base64url"),
  );
  if (!valid)
    throw new MonetizationError(
      "Podpis callbacku AdMob jest nieprawidłowy.",
      403,
      "INVALID_SSV_SIGNATURE",
    );

  const expectedAdUnitId =
    process.env.ADMOB_REWARDED_AD_UNIT_ID?.split("/").pop();
  if (expectedAdUnitId && params.get("ad_unit") !== expectedAdUnitId) {
    throw new MonetizationError(
      "Callback pochodzi z nieoczekiwanej jednostki reklamowej.",
      403,
      "INVALID_AD_UNIT",
    );
  }
  if (
    params.get("reward_item") !== "recognition" ||
    params.get("reward_amount") !== "1"
  ) {
    throw new MonetizationError(
      "Callback nie odpowiada reklamie nagradzającej rozpoznaniem.",
      403,
      "INVALID_AD_REWARD",
    );
  }

  const token = verifyRewardToken(params.get("custom_data"));
  if (
    validateInstallationId(params.get("user_id")) !==
    validateInstallationId(token.installationId)
  ) {
    throw new MonetizationError(
      "Callback AdMob nie pasuje do instalacji.",
      403,
      "REWARD_OWNER_MISMATCH",
    );
  }
  if (token.accountUserId) {
    const { addAccountRewardCredit } = await import("../auth/account-usage.mjs");
    await addAccountRewardCredit(
      token.accountUserId,
      token.nonce,
      params.get("transaction_id"),
    );
    return;
  }
  addRewardCredit(
    token.installationId,
    token.nonce,
    params.get("transaction_id"),
  );
}
