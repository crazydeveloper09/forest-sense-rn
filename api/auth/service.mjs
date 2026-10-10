import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { decryptAesGcm, encryptAesGcm } from "../crypto/aes-gcm.mjs";
import { getDb } from "../db/mongo.mjs";
import { AuthError } from "./errors.mjs";
import { hashPassword, verifyPassword } from "./passwords.mjs";
import { createTotpSecret, verifyTotp } from "./totp.mjs";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MFA_MS = 5 * 60 * 1000;
const MAX_PROFILE_CIPHERTEXT = 8_000;
const loginAttempts = new Map();

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function newToken() {
  return randomBytes(32).toString("base64url");
}

function assertSealed(value, label, maxLength = MAX_PROFILE_CIPHERTEXT) {
  if (
    !value ||
    typeof value.ciphertext !== "string" ||
    typeof value.iv !== "string" ||
    value.ciphertext.length === 0 ||
    value.ciphertext.length > maxLength ||
    value.iv.length > 64
  ) {
    throw new AuthError(`Brak prawidłowo zaszyfrowanego pola: ${label}.`, 400, "INVALID_CIPHERTEXT");
  }
  const iv = Buffer.from(value.iv, "base64");
  const body = Buffer.from(value.ciphertext, "base64");
  if (iv.length !== 12 || body.length < 16) {
    throw new AuthError(`Nieprawidłowy szyfrogram pola: ${label}.`, 400, "INVALID_CIPHERTEXT");
  }
}

function assertRegistration(body) {
  if (!/^[0-9a-f]{64}$/i.test(body?.emailLookup ?? "")) {
    throw new AuthError("Nieprawidłowy identyfikator adresu e-mail.", 400, "INVALID_EMAIL");
  }
  if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) {
    throw new AuthError("Hasło musi mieć od 10 do 128 znaków.", 400, "WEAK_PASSWORD");
  }
}

function assertProfile(body) {
  assertSealed(body.email, "e-mail");
  assertSealed(body.displayName, "nazwa");
  const salt = Buffer.from(String(body.kdfSalt ?? ""), "base64");
  if (salt.length !== 16) {
    throw new AuthError("Brak prawidłowej soli klucza szyfrowania.", 400, "INVALID_KDF_SALT");
  }
}

function publicProfile(user) {
  return {
    email: { ciphertext: user.emailCiphertext, iv: user.emailIv },
    displayName: { ciphertext: user.nameCiphertext, iv: user.nameIv },
  };
}

function sessionPayload(user, accessToken) {
  return {
    accessToken,
    userId: user._id.toHexString(),
    kdfSalt: user.kdfSalt,
    profile: publicProfile(user),
  };
}

async function issueMfa(user, purpose) {
  const db = await getDb();
  const mfaToken = newToken();
  await db.collection("mfa_challenges").insertOne({
    tokenHash: tokenHash(mfaToken),
    userId: user._id,
    purpose,
    attempts: 0,
    expiresAt: new Date(Date.now() + MFA_MS),
    createdAt: new Date(),
  });
  const response = {
    mfaToken,
    purpose,
    expiresIn: Math.floor(MFA_MS / 1000),
    profileReady: Boolean(user.kdfSalt && user.emailCiphertext && user.nameCiphertext),
  };
  if (purpose === "enroll") {
    response.totpSecret = decryptAesGcm(user.totpSecretCiphertext, user.totpSecretIv);
  }
  return response;
}

function assertLoginRate(emailLookup) {
  const entry = loginAttempts.get(emailLookup);
  if (entry && entry.resetAt > Date.now() && entry.count >= 8) {
    throw new AuthError("Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.", 429, "RATE_LIMITED");
  }
}

function recordLoginFailure(emailLookup) {
  if (loginAttempts.size > 5000) {
    const now = Date.now();
    for (const [key, entry] of loginAttempts) {
      if (entry.resetAt <= now) loginAttempts.delete(key);
    }
  }
  const current = loginAttempts.get(emailLookup);
  if (!current || current.resetAt <= Date.now()) {
    loginAttempts.set(emailLookup, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
    return;
  }
  current.count += 1;
}

function clearLoginFailures(emailLookup) {
  loginAttempts.delete(emailLookup);
}

let dummyPasswordHash;
function dummyHash() {
  dummyPasswordHash ??= hashPassword("forest-sense-dummy-password");
  return dummyPasswordHash;
}

export async function registerAccount(body) {
  assertRegistration(body);
  const db = await getDb();
  const totpSecret = createTotpSecret();
  const sealedSecret = encryptAesGcm(totpSecret);
  const now = new Date();
  try {
    const result = await db.collection("users").insertOne({
      emailLookup: body.emailLookup.toLowerCase(),
      passwordHash: hashPassword(body.password),
      totpSecretCiphertext: sealedSecret.ciphertext,
      totpSecretIv: sealedSecret.iv,
      totpConfirmed: false,
      createdAt: now,
      updatedAt: now,
    });
    const user = await db.collection("users").findOne({ _id: result.insertedId });
    return issueMfa(user, "enroll");
  } catch (error) {
    if (error?.code === 11000) {
      throw new AuthError("Konto z tym adresem e-mail już istnieje.", 409, "EMAIL_TAKEN");
    }
    throw error;
  }
}

export async function attachEncryptedProfile(body) {
  const mfaToken = String(body?.mfaToken ?? "");
  if (mfaToken.length < 20) {
    throw new AuthError("Sesja weryfikacji wygasła. Zarejestruj się ponownie.", 401, "MFA_EXPIRED");
  }
  assertProfile(body);
  const db = await getDb();
  const challenge = await db.collection("mfa_challenges").findOne({
    tokenHash: tokenHash(mfaToken),
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) {
    throw new AuthError("Sesja weryfikacji wygasła. Zarejestruj się ponownie.", 401, "MFA_EXPIRED");
  }
  const result = await db.collection("users").updateOne(
    { _id: challenge.userId, totpConfirmed: false },
    {
      $set: {
        emailCiphertext: body.email.ciphertext,
        emailIv: body.email.iv,
        nameCiphertext: body.displayName.ciphertext,
        nameIv: body.displayName.iv,
        kdfSalt: body.kdfSalt,
        updatedAt: new Date(),
      },
    },
  );
  if (result.matchedCount !== 1) {
    throw new AuthError("Nie można dopisać profilu do tego konta.", 409, "PROFILE_LOCKED");
  }
  return { ok: true };
}

export async function loginAccount(body) {
  const emailLookup = String(body?.emailLookup ?? "").toLowerCase();
  const password = body?.password;
  if (!/^[0-9a-f]{64}$/.test(emailLookup) || typeof password !== "string") {
    throw new AuthError("Podaj adres e-mail i hasło.", 400, "INVALID_CREDENTIALS");
  }
  assertLoginRate(emailLookup);
  const db = await getDb();
  const user = await db.collection("users").findOne({ emailLookup });
  const passwordMatches = verifyPassword(password, user?.passwordHash ?? dummyHash());
  if (!user || !passwordMatches) {
    recordLoginFailure(emailLookup);
    throw new AuthError("Nieprawidłowy adres e-mail lub hasło.", 401, "INVALID_CREDENTIALS");
  }
  clearLoginFailures(emailLookup);
  return issueMfa(user, user.totpConfirmed ? "login" : "enroll");
}

export async function verifyMfa(body) {
  const mfaToken = String(body?.mfaToken ?? "");
  const code = String(body?.code ?? "");
  if (mfaToken.length < 20) {
    throw new AuthError("Sesja weryfikacji wygasła. Zaloguj się ponownie.", 401, "MFA_EXPIRED");
  }
  const db = await getDb();
  const challenge = await db.collection("mfa_challenges").findOne({
    tokenHash: tokenHash(mfaToken),
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) {
    throw new AuthError("Sesja weryfikacji wygasła. Zaloguj się ponownie.", 401, "MFA_EXPIRED");
  }
  const user = await db.collection("users").findOne({ _id: challenge.userId });
  if (!user) {
    await db.collection("mfa_challenges").deleteOne({ _id: challenge._id });
    throw new AuthError("Nie znaleziono konta.", 401, "ACCOUNT_MISSING");
  }
  if (!user.kdfSalt || !user.emailCiphertext || !user.nameCiphertext) {
    throw new AuthError("Profil jest jeszcze szyfrowany. Spróbuj ponownie za chwilę.", 409, "PROFILE_PENDING");
  }
  const secret = decryptAesGcm(user.totpSecretCiphertext, user.totpSecretIv);
  if (!verifyTotp(secret, code)) {
    const attempts = (challenge.attempts ?? 0) + 1;
    if (attempts >= 5) {
      await db.collection("mfa_challenges").deleteOne({ _id: challenge._id });
      throw new AuthError("Zbyt wiele błędnych kodów. Zaloguj się ponownie.", 401, "MFA_LOCKED");
    }
    await db.collection("mfa_challenges").updateOne({ _id: challenge._id }, { $set: { attempts } });
    throw new AuthError("Nieprawidłowy kod weryfikacji dwuetapowej.", 401, "INVALID_TOTP");
  }

  await db.collection("mfa_challenges").deleteOne({ _id: challenge._id });
  if (!user.totpConfirmed) {
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { totpConfirmed: true, updatedAt: new Date() } },
    );
  }
  const accessToken = newToken();
  await db.collection("sessions").insertOne({
    tokenHash: tokenHash(accessToken),
    userId: user._id,
    expiresAt: new Date(Date.now() + SESSION_MS),
    createdAt: new Date(),
  });
  return sessionPayload(user, accessToken);
}

export async function userFromRequest(request) {
  const header = request.headers.authorization ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(Array.isArray(header) ? header[0] : header);
  if (!match) {
    throw new AuthError("Zaloguj się, aby kontynuować.", 401, "AUTH_REQUIRED");
  }
  const db = await getDb();
  const session = await db.collection("sessions").findOne({
    tokenHash: tokenHash(match[1]),
    expiresAt: { $gt: new Date() },
  });
  if (!session) {
    throw new AuthError("Sesja wygasła. Zaloguj się ponownie.", 401, "SESSION_EXPIRED");
  }
  const user = await db.collection("users").findOne({ _id: session.userId });
  if (!user?.totpConfirmed) {
    throw new AuthError("Dokończ weryfikację dwuetapową.", 401, "MFA_REQUIRED");
  }
  return {
    id: user._id.toHexString(),
    kdfSalt: user.kdfSalt,
    profile: publicProfile(user),
  };
}

export async function logoutAccount(request) {
  const header = request.headers.authorization ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(Array.isArray(header) ? header[0] : header);
  if (!match) return { ok: true };
  const db = await getDb();
  await db.collection("sessions").deleteOne({ tokenHash: tokenHash(match[1]) });
  return { ok: true };
}

export async function accountBilling(userId) {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getDb();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(userId) },
    { projection: { premiumUntil: 1, subscriptionStatus: 1, stripeCustomerId: 1 } },
  );
  if (!user?.premiumUntil) return null;
  return {
    premiumUntil: user.premiumUntil,
    subscriptionStatus: user.subscriptionStatus,
    stripeCustomerId: user.stripeCustomerId ?? null,
  };
}

export async function recordSubscriptionOwner(userId, subscription) {
  if (!process.env.MONGODB_URI?.trim() || !ObjectId.isValid(userId)) return;
  const endSeconds =
    subscription.current_period_end ?? subscription.items?.data?.[0]?.current_period_end ?? 0;
  const customer =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  const db = await getDb();
  await db.collection("users").updateOne(
    { _id: new ObjectId(userId) },
    {
      $set: {
        stripeCustomerId: customer ?? null,
        subscriptionStatus: subscription.status,
        premiumUntil: endSeconds * 1000,
        "billing.premiumUntil": endSeconds * 1000,
        "billing.subscriptionStatus": subscription.status,
        "billing.stripeCustomerId": customer ?? null,
        "billing.plan": endSeconds * 1000 > Date.now() ? "premium" : "free",
        updatedAt: new Date(),
      },
    },
  );
}

