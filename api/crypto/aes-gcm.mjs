import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function serverEncryptionKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY?.trim();
  if (!raw || raw.length < 32) {
    const error = new Error(
      "Ustaw DATA_ENCRYPTION_KEY (32 bajty w base64 albo 64 znaki hex).",
    );
    error.status = 503;
    error.code = "ENCRYPTION_KEY_MISSING";
    throw error;
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const base64 = /^[A-Za-z0-9+/]{43,44}={0,2}$/.test(raw);
  const base64Url = /^[A-Za-z0-9_-]{43,44}$/.test(raw);
  if (base64 || base64Url) {
    const decoded = Buffer.from(raw, base64 ? "base64" : "base64url");
    if (decoded.length === 32) return decoded;
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptAesGcm(plaintext, key = serverEncryptionKey()) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString(
      "base64",
    ),
    iv: iv.toString("base64"),
  };
}

export function decryptAesGcm(ciphertext, iv, key = serverEncryptionKey()) {
  const ivBytes = Buffer.from(iv, "base64");
  const sealed = Buffer.from(ciphertext, "base64");
  if (ivBytes.length !== IV_LENGTH || sealed.length < TAG_LENGTH) {
    throw new Error("Nieprawidłowy szyfrogram AES-256-GCM.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, ivBytes);
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_LENGTH));
  return Buffer.concat([
    decipher.update(sealed.subarray(0, sealed.length - TAG_LENGTH)),
    decipher.final(),
  ]).toString("utf8");
}
