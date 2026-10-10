import * as SecureStore from 'expo-secure-store';
import { base64ToBytes, bytesToBase64 } from '../crypto/e2e';

const TOKEN_KEY = 'forest-sense-access-token';
const DATA_KEY_KEY = 'forest-sense-data-key';
const USER_ID_KEY = 'forest-sense-user-id';
const PROFILE_KEY = 'forest-sense-profile';

export type AccountProfile = {
  id: string;
  email: string;
  displayName: string;
};

type MemorySession = AccountProfile & {
  accessToken: string;
  dataKey: Uint8Array;
};

let current: MemorySession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAccessToken(): string | null {
  return current?.accessToken ?? null;
}

export function getDataKey(): Uint8Array | null {
  return current?.dataKey ?? null;
}

export function getCurrentUserId(): string | null {
  return current?.id ?? null;
}

export function getCurrentProfile(): AccountProfile | null {
  if (!current) return null;
  return { id: current.id, email: current.email, displayName: current.displayName };
}

export async function loadSession(): Promise<AccountProfile | null> {
  const [accessToken, dataKeyB64, userId, profileJson] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEY),
    SecureStore.getItemAsync(DATA_KEY_KEY),
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(PROFILE_KEY),
  ]);
  if (!accessToken || !dataKeyB64 || !userId || !profileJson) {
    current = null;
    return null;
  }

  try {
    const profile = JSON.parse(profileJson) as { email?: string; displayName?: string };
    if (typeof profile.email !== 'string' || typeof profile.displayName !== 'string') {
      throw new Error('Niepełny profil.');
    }
    current = {
      accessToken,
      dataKey: base64ToBytes(dataKeyB64),
      id: userId,
      email: profile.email,
      displayName: profile.displayName,
    };
    return getCurrentProfile();
  } catch {
    await clearSession();
    return null;
  }
}

export async function persistSession(session: MemorySession): Promise<void> {
  current = session;
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.accessToken),
    SecureStore.setItemAsync(DATA_KEY_KEY, bytesToBase64(session.dataKey)),
    SecureStore.setItemAsync(USER_ID_KEY, session.id),
    SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify({ email: session.email, displayName: session.displayName })),
  ]);
  emit();
}

export async function clearSession(): Promise<void> {
  current = null;
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync(DATA_KEY_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(PROFILE_KEY),
  ]);
  emit();
}
