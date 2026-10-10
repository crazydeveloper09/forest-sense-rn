import assert from "node:assert/strict";
import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";
import test from "node:test";
import { gcm } from "@noble/ciphers/aes.js";
import { utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils.js";
import { decryptAesGcm, encryptAesGcm } from "./crypto/aes-gcm.mjs";
import { hashPassword, verifyPassword } from "./auth/passwords.mjs";
import { base32Decode, totpCode, verifyTotp } from "./auth/totp.mjs";

test("AES-256-GCM roundtrip rejects tampered ciphertext", () => {
  process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  const sealed = encryptAesGcm("jan@example.com");
  assert.equal(decryptAesGcm(sealed.ciphertext, sealed.iv), "jan@example.com");

  const tampered = Buffer.from(sealed.ciphertext, "base64");
  tampered[0] ^= 0xff;
  assert.throws(() => decryptAesGcm(tampered.toString("base64"), sealed.iv));
});

test("password hash verifies only the original password", () => {
  const stored = hashPassword("grzybnia-1234");
  assert.equal(verifyPassword("grzybnia-1234", stored), true);
  assert.equal(verifyPassword("grzybnia-1235", stored), false);
  assert.equal(stored.includes("grzybnia-1234"), false);
});

test("TOTP matches RFC 6238 SHA1 vectors", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(base32Decode(secret).toString("utf8"), "12345678901234567890");
  const vectors = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [unixSeconds, code] of vectors) {
    assert.equal(totpCode(secret, unixSeconds * 1000), code);
    assert.equal(verifyTotp(secret, code, unixSeconds * 1000, 0), true);
  }
  assert.equal(verifyTotp(secret, "000000", 59 * 1000, 0), false);
});

test("device AES-256-GCM ciphertext opens with Node crypto and the reverse", () => {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const sealed = Buffer.from(gcm(key, iv).encrypt(utf8ToBytes("borowik szlachetny")));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - 16)),
    decipher.final(),
  ]).toString("utf8");
  assert.equal(plain, "borowik szlachetny");

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update("muchomor", "utf8"), cipher.final(), cipher.getAuthTag()]);
  assert.equal(bytesToUtf8(gcm(key, iv).decrypt(encrypted)), "muchomor");
});
