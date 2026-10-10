import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { createRewardToken, verifyRewardToken } from "../monetization/admob-rewards.mjs";
import { MonetizationError } from "../monetization/errors.mjs";
import {
  emptyUsageRecord,
  getRecord,
  normalizeRecord,
  premiumActive,
  usageForRecord,
  validateInstallationId,
  FREE_MONTHLY_LIMIT,
} from "../monetization/usage-store.mjs";
import { getDb } from "../db/mongo.mjs";
import { AuthError } from "./errors.mjs";

const REWARD_TOKEN_TTL_MS = 10 * 60 * 1000;

function installationSnapshot(installationId) {
  try {
    return getRecord(installationId);
  } catch {
    return null;
  }
}

function recordFromUser(user, installationId) {
  const stored = user.billing;
  const record = stored?.initialized
    ? {
        ...emptyUsageRecord(),
        ...stored,
        pendingRewards: stored.pendingRewards ?? [],
        processedAdTransactions: stored.processedAdTransactions ?? [],
      }
    : emptyUsageRecord();
  record.premiumUntil = Math.max(record.premiumUntil || 0, user.premiumUntil || 0);
  record.subscriptionStatus = record.subscriptionStatus || user.subscriptionStatus || "inactive";
  record.stripeCustomerId = record.stripeCustomerId || user.stripeCustomerId || null;

  if (!stored?.initialized) {
    const local = installationSnapshot(installationId);
    if (local) {
      record.month = local.month;
      record.monthlyUsed = local.monthlyUsed;
      record.day = local.day;
      record.dailyUsed = local.dailyUsed;
      record.rewardCredits = local.rewardCredits;
      record.pendingRewards = local.pendingRewards ?? [];
      if ((local.premiumUntil || 0) > record.premiumUntil) {
        record.premiumUntil = local.premiumUntil;
        record.subscriptionStatus = local.subscriptionStatus;
        record.stripeCustomerId = local.stripeCustomerId || record.stripeCustomerId;
      }
    }
  }
  record.plan = record.premiumUntil > Date.now() ? "premium" : "free";
  return normalizeRecord(record);
}

function billingDocument(record) {
  return {
    initialized: true,
    plan: record.plan,
    subscriptionStatus: record.subscriptionStatus,
    premiumUntil: record.premiumUntil,
    stripeCustomerId: record.stripeCustomerId ?? null,
    month: record.month,
    monthlyUsed: record.monthlyUsed,
    day: record.day,
    dailyUsed: record.dailyUsed,
    rewardCredits: record.rewardCredits,
    pendingRewards: record.pendingRewards ?? [],
    processedAdTransactions: record.processedAdTransactions ?? [],
  };
}

async function withAccountRecord(userId, installationId, mutator) {
  if (!ObjectId.isValid(userId)) {
    throw new AuthError("Nieprawidłowe konto.", 401, "ACCOUNT_MISSING");
  }
  const db = await getDb();
  const _id = new ObjectId(userId);
  const user = await db.collection("users").findOne({ _id });
  if (!user) throw new AuthError("Nie znaleziono konta.", 401, "ACCOUNT_MISSING");
  const record = recordFromUser(user, installationId);
  const result = mutator(record);
  await db.collection("users").updateOne(
    { _id },
    {
      $set: {
        billing: billingDocument(record),
        premiumUntil: record.premiumUntil,
        subscriptionStatus: record.subscriptionStatus,
        updatedAt: new Date(),
      },
    },
  );
  return result;
}

function quotaError(record, installationId) {
  const error = new MonetizationError(
    "Wykorzystano limit rozpoznań. Obejrzyj reklamę, aby odblokować jedno dodatkowe rozpoznanie, lub wróć po odnowieniu limitu.",
    429,
    "QUOTA_EXCEEDED",
  );
  error.scope = "account";
  error.installationId = installationId;
  error.usage = usageForRecord(record);
  return error;
}

export function getAccountUsage(userId, installationId) {
  return withAccountRecord(userId, installationId, (record) => usageForRecord(record));
}

export function reserveAccountRecognition(userId, installationId) {
  return withAccountRecord(userId, installationId, (record) => {
    const usage = usageForRecord(record);
    if (!usage.canRecognize) throw quotaError(record, installationId);
    let source;
    if (usage.plan === "premium") {
      record.dailyUsed += 1;
      source = "premium";
    } else if (record.monthlyUsed < FREE_MONTHLY_LIMIT) {
      record.monthlyUsed += 1;
      source = "monthly";
    } else {
      record.rewardCredits -= 1;
      source = "reward";
    }
    return { scope: "account", userId, installationId, source };
  });
}

export function refundAccountRecognition(reservation) {
  return withAccountRecord(reservation.userId, reservation.installationId, (record) => {
    if (reservation.source === "premium") record.dailyUsed = Math.max(0, record.dailyUsed - 1);
    else if (reservation.source === "monthly") record.monthlyUsed = Math.max(0, record.monthlyUsed - 1);
    else record.rewardCredits += 1;
    return usageForRecord(record);
  });
}

export function startAccountReward(userId, installationId) {
  validateInstallationId(installationId);
  return withAccountRecord(userId, installationId, (record) => {
    if (premiumActive(record)) {
      throw new MonetizationError("Premium nie wyświetla reklam z nagrodą.", 403, "PREMIUM_NO_ADS");
    }
    if (usageForRecord(record).canRecognize) {
      throw new MonetizationError("Najpierw wykorzystaj dostępny limit rozpoznań.", 409, "QUOTA_NOT_EXHAUSTED");
    }
    const nonce = randomBytes(24).toString("base64url");
    const expiresAt = Date.now() + REWARD_TOKEN_TTL_MS;
    record.pendingRewards.push({ nonce, expiresAt });
    return {
      customData: createRewardToken(installationId, nonce, expiresAt, userId),
      userId: installationId,
    };
  });
}

export function claimAccountDevelopmentReward(userId, installationId, customData) {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_UNVERIFIED_AD_REWARDS !== "true") {
    throw new MonetizationError("Nagrody można przyznawać wyłącznie po weryfikacji AdMob.", 403, "SSV_REQUIRED");
  }
  const token = verifyRewardToken(customData);
  if (validateInstallationId(installationId) !== validateInstallationId(token.installationId)) {
    throw new MonetizationError("Nagroda należy do innej instalacji.", 403, "REWARD_OWNER_MISMATCH");
  }
  if (token.accountUserId !== userId) {
    throw new MonetizationError("Nagroda należy do innego konta.", 403, "REWARD_OWNER_MISMATCH");
  }
  return addAccountRewardCredit(userId, token.nonce, `dev-${token.nonce}`, installationId);
}

export function addAccountRewardCredit(userId, nonce, transactionId, installationId) {
  if (typeof transactionId !== "string" || transactionId.length < 8) {
    throw new MonetizationError(
      "Callback AdMob nie zawiera prawidłowego identyfikatora transakcji.",
      400,
      "INVALID_AD_TRANSACTION",
    );
  }
  return withAccountRecord(userId, installationId, (record) => {
    if ((record.processedAdTransactions ?? []).includes(transactionId)) return usageForRecord(record);
    const pendingIndex = record.pendingRewards.findIndex(
      (reward) => reward.nonce === nonce && reward.expiresAt > Date.now(),
    );
    if (pendingIndex < 0) {
      throw new MonetizationError("Nagroda nie pasuje do oczekującej reklamy.", 409, "REWARD_NOT_PENDING");
    }
    record.pendingRewards.splice(pendingIndex, 1);
    record.rewardCredits += 1;
    record.processedAdTransactions = [...(record.processedAdTransactions ?? []), transactionId].slice(-1000);
    return usageForRecord(record);
  });
}
