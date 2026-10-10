import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "forest-sense-billing-"));
const billingFile = join(temporaryDirectory, "state.json");
const freeInstallationId = randomUUID();
const premiumInstallationId = randomUUID();
const now = new Date();
const today = now.toISOString().slice(0, 10);
const month = now.toISOString().slice(0, 7);
const keyPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const publicKey = keyPair.publicKey.export({ type: "spki", format: "pem" });

process.env.BILLING_DATA_FILE = billingFile;
process.env.ADMOB_SSV_TOKEN_SECRET =
  "test-secret-string-long-enough-for-hmac-validation";
process.env.ADMOB_REWARDED_AD_UNIT_ID = "ca-app-pub-test/test-unit-123";
process.env.ALLOW_UNVERIFIED_AD_REWARDS = "true";

writeFileSync(
  billingFile,
  JSON.stringify({
    users: {
      [premiumInstallationId]: {
        plan: "premium",
        subscriptionStatus: "active",
        premiumUntil: Date.now() + 86_400_000,
        month,
        monthlyUsed: 0,
        day: today,
        dailyUsed: 0,
        rewardCredits: 0,
        pendingRewards: [],
      },
    },
    processedAdTransactions: [],
  }),
);

const monetization = await import("./monetization.mjs");

test("free tier allows ten monthly requests, then blocks the next one", () => {
  for (let index = 0; index < 10; index += 1) {
    monetization.reserveRecognition(freeInstallationId);
  }

  const usage = monetization.getUsageStatus(freeInstallationId);
  assert.equal(usage.monthlyUsed, 10);
  assert.equal(usage.remaining, 0);
  assert.throws(
    () => monetization.reserveRecognition(freeInstallationId),
    (error) => error.code === "QUOTA_EXCEEDED",
  );
});

test("verified AdMob SSV callback grants one idempotent bonus recognition", async () => {
  const rewardRequest = monetization.startReward(freeInstallationId);
  const query = new URLSearchParams({
    ad_network: "test",
    ad_unit: "test-unit-123",
    custom_data: rewardRequest.customData,
    reward_amount: "1",
    reward_item: "recognition",
    timestamp: String(Date.now()),
    transaction_id: randomUUID().replaceAll("-", ""),
    user_id: rewardRequest.userId,
  }).toString();
  const signature = sign(
    "sha256",
    Buffer.from(query),
    keyPair.privateKey,
  ).toString("base64url");
  const callbackUrl = `/admob/ssv?${query}&signature=${signature}&key_id=321`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ keys: [{ keyId: 321, pem: publicKey }] }), {
      status: 200,
    });

  try {
    await monetization.verifyAdmobCallback(callbackUrl);
    await monetization.verifyAdmobCallback(callbackUrl);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const afterVerification = monetization.getUsageStatus(freeInstallationId);
  assert.equal(afterVerification.rewardCredits, 1);
  assert.equal(afterVerification.remaining, 1);
  assert.equal(
    monetization.reserveRecognition(freeInstallationId).source,
    "reward",
  );
  assert.equal(monetization.getUsageStatus(freeInstallationId).remaining, 0);
});

test("Premium allows one recognition per UTC day", () => {
  const initialUsage = monetization.getUsageStatus(premiumInstallationId);
  assert.equal(initialUsage.plan, "premium");
  assert.equal(initialUsage.remaining, 1);
  assert.equal(
    monetization.reserveRecognition(premiumInstallationId).source,
    "premium",
  );
  assert.throws(
    () => monetization.reserveRecognition(premiumInstallationId),
    (error) => error.code === "QUOTA_EXCEEDED",
  );
  assert.equal(monetization.getUsageStatus(premiumInstallationId).remaining, 0);
});

test.after(() => {
  rmSync(temporaryDirectory, { recursive: true, force: true });
});
