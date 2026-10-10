import './polyfill';
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToUtf8, randomBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const KDF_ITERATIONS = 210_000;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export type SealedPayload = {
  ciphertext: string;
  iv: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailLookup(email: string): string {
  return bytesToHex(sha256(utf8ToBytes(normalizeEmail(email))));
}

export function createKdfSalt(): Uint8Array {
  return randomBytes(16);
}

export async function deriveDataKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha256, utf8ToBytes(password), salt, {
    c: KDF_ITERATIONS,
    dkLen: 32,
    asyncTick: 50,
  });
}

export function encryptUtf8(plaintext: string, key: Uint8Array): SealedPayload {
  const iv = randomBytes(12);
  const sealed = gcm(key, iv).encrypt(utf8ToBytes(plaintext));
  return { ciphertext: bytesToBase64(sealed), iv: bytesToBase64(iv) };
}

export function decryptUtf8(ciphertext: string, iv: string, key: Uint8Array): string {
  const plain = gcm(key, base64ToBytes(iv)).decrypt(base64ToBytes(ciphertext));
  return bytesToUtf8(plain);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triplet = (first << 16) | (second << 8) | third;
    output += B64[(triplet >> 18) & 63];
    output += B64[(triplet >> 12) & 63];
    output += index + 1 < bytes.length ? B64[(triplet >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? B64[triplet & 63] : '=';
  }
  return output;
}

export function base64ToBytes(value: string): Uint8Array {
  const clean = value.replace(/\s/g, '');
  if (clean.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(clean)) {
    throw new Error('Nieprawidłowe dane zaszyfrowane.');
  }
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const length = (clean.length / 4) * 3 - padding;
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const thirdChar = clean[index + 2] === '=' ? 0 : B64.indexOf(clean[index + 2] ?? '');
    const fourthChar = clean[index + 3] === '=' ? 0 : B64.indexOf(clean[index + 3] ?? '');
    const triplet =
      (B64.indexOf(clean[index] ?? '') << 18) |
      (B64.indexOf(clean[index + 1] ?? '') << 12) |
      (thirdChar << 6) |
      fourthChar;
    bytes[offset] = (triplet >> 16) & 255;
    offset += 1;
    if (offset < length) {
      bytes[offset] = (triplet >> 8) & 255;
      offset += 1;
    }
    if (offset < length) {
      bytes[offset] = triplet & 255;
      offset += 1;
    }
  }
  return bytes;
}
