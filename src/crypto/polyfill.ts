import { getRandomValues } from 'expo-crypto';

const scope = globalThis as { crypto?: { getRandomValues?: (bytes: Uint8Array) => Uint8Array } };

if (typeof scope.crypto?.getRandomValues !== 'function') {
  scope.crypto = { getRandomValues };
}
