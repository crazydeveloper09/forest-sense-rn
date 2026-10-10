import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MonetizationError } from "./errors.mjs";

const DATA_FILE =
  process.env.BILLING_DATA_FILE ||
  join(dirname(fileURLToPath(import.meta.url)), "..", "data", "billing.json");
export const FREE_MONTHLY_LIMIT = 10;
export const PREMIUM_DAILY_LIMIT = 1;

function readState() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { users: {}, processedAdTransactions: [] };
  }
}

let state = readState();

function persistState() {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  writeFileSync(tempFile, JSON.stringify(state), { mode: 0o600 });
  renameSync(tempFile, DATA_FILE);
}

export function validateInstallationId(installationId) {
  if (
    typeof installationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      installationId,
    )
  ) {
    throw new MonetizationError(
      "Nieprawidłowy identyfikator instalacji.",
      400,
      "INVALID_INSTALLATION_ID",
    );
  }
  return installationId.toLowerCase();
}

function monthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function nextUtcDay(date = new Date()) {
  const next = new Date(date);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

function nextUtcMonth(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1),
  ).toISOString();
}

export function emptyUsageRecord() {
  return {
    plan: "free",
    subscriptionStatus: "inactive",
    premiumUntil: 0,
    stripeCustomerId: null,
    month: monthKey(),
    monthlyUsed: 0,
    day: dayKey(),
    dailyUsed: 0,
    rewardCredits: 0,
    pendingRewards: [],
  };
}

export function normalizeRecord(record) {
  if (record.month !== monthKey()) {
    record.month = monthKey();
    record.monthlyUsed = 0;
  }
  if (record.day !== dayKey()) {
    record.day = dayKey();
    record.dailyUsed = 0;
  }
  record.pendingRewards = (record.pendingRewards ?? []).filter(
    (reward) => reward.expiresAt > Date.now(),
  );
  return record;
}

export function getRecord(installationId) {
  const id = validateInstallationId(installationId);
  let record = state.users[id];
  if (!record) {
    record = emptyUsageRecord();
    state.users[id] = record;
  }
  return normalizeRecord(record);
}

export function premiumActive(record) {
  return record.plan === "premium" && record.premiumUntil > Date.now();
}

export function usageForRecord(record) {
  const premium = premiumActive(record);
  const remaining = premium
    ? Math.max(0, PREMIUM_DAILY_LIMIT - record.dailyUsed)
    : Math.max(0, FREE_MONTHLY_LIMIT - record.monthlyUsed) +
      record.rewardCredits;
  return {
    plan: premium ? "premium" : "free",
    monthlyUsed: record.monthlyUsed,
    monthlyLimit: FREE_MONTHLY_LIMIT,
    dailyUsed: record.dailyUsed,
    dailyLimit: PREMIUM_DAILY_LIMIT,
    rewardCredits: record.rewardCredits,
    remaining,
    canRecognize: remaining > 0,
    resetAt: premium ? nextUtcDay() : nextUtcMonth(),
  };
}

export function getUsageStatus(installationId) {
  const record = getRecord(installationId);
  persistState();
  return usageForRecord(record);
}

export function reserveRecognition(installationId) {
  const id = validateInstallationId(installationId);
  const record = getRecord(id);
  const usage = usageForRecord(record);
  if (!usage.canRecognize) {
    const error = new MonetizationError(
      "Wykorzystano limit rozpoznań. Obejrzyj reklamę, aby odblokować jedno dodatkowe rozpoznanie, lub wróć po odnowieniu limitu.",
      429,
      "QUOTA_EXCEEDED",
    );
    error.installationId = id;
    throw error;
  }

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
  persistState();
  return { installationId: id, source };
}

export function refundRecognition(reservation) {
  const record = getRecord(reservation.installationId);
  if (reservation.source === "premium")
    record.dailyUsed = Math.max(0, record.dailyUsed - 1);
  else if (reservation.source === "monthly")
    record.monthlyUsed = Math.max(0, record.monthlyUsed - 1);
  else record.rewardCredits += 1;
  persistState();
}

export function addRewardCredit(installationId, nonce, transactionId) {
  const id = validateInstallationId(installationId);
  if (typeof transactionId !== "string" || transactionId.length < 8) {
    throw new MonetizationError(
      "Callback AdMob nie zawiera prawidłowego identyfikatora transakcji.",
      400,
      "INVALID_AD_TRANSACTION",
    );
  }
  if (state.processedAdTransactions.includes(transactionId)) return false;
  const record = getRecord(id);
  const pendingIndex = record.pendingRewards.findIndex(
    (reward) => reward.nonce === nonce && reward.expiresAt > Date.now(),
  );
  if (pendingIndex < 0) {
    throw new MonetizationError(
      "Nagroda nie pasuje do oczekującej reklamy.",
      409,
      "REWARD_NOT_PENDING",
    );
  }
  record.pendingRewards.splice(pendingIndex, 1);
  record.rewardCredits += 1;
  state.processedAdTransactions.push(transactionId);
  if (state.processedAdTransactions.length > 10_000) {
    state.processedAdTransactions.splice(
      0,
      state.processedAdTransactions.length - 10_000,
    );
  }
  persistState();
  return true;
}

export function addPendingReward(installationId, reward) {
  const record = getRecord(installationId);
  record.pendingRewards.push(reward);
  persistState();
}

export function grantPremiumFromAccount(installationId, account) {
  if (!account || !(account.premiumUntil > Date.now())) return;
  const record = getRecord(installationId);
  if ((record.premiumUntil ?? 0) >= account.premiumUntil && premiumActive(record)) return;
  record.premiumUntil = account.premiumUntil;
  record.subscriptionStatus = account.subscriptionStatus || "active";
  record.plan = "premium";
  if (account.stripeCustomerId) record.stripeCustomerId = account.stripeCustomerId;
  persistState();
}

export function updateSubscription(installationId, subscription) {
  const record = getRecord(installationId);
  const endSeconds =
    subscription.current_period_end ??
    subscription.items?.data?.[0]?.current_period_end ??
    0;
  record.premiumUntil = endSeconds * 1000;
  record.subscriptionStatus = subscription.status;
  record.stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  record.plan =
    ["active", "trialing", "past_due"].includes(subscription.status) ||
    record.premiumUntil > Date.now()
      ? "premium"
      : "free";
  persistState();
}
