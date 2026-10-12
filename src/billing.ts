import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getAccessToken } from './auth/session';

export type UsageStatus = {
  plan: 'free' | 'premium';
  monthlyUsed: number;
  monthlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
  rewardCredits: number;
  remaining: number;
  canRecognize: boolean;
  resetAt: string;
};

const API_BASE_URL = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/$/, '');
const INSTALLATION_ID_KEY = 'forest-sense-installation-id';
const USAGE_TTL_MS = 15_000;
let installationIdPromise: Promise<string> | null = null;
let latestUsage: UsageStatus | null = null;
let usageFetchedAt = 0;
let usageRequest: Promise<UsageStatus> | null = null;
const usageListeners = new Set<(usage: UsageStatus) => void>();

export function getCachedUsage(): UsageStatus | null {
  return latestUsage;
}

export function subscribeUsage(listener: (usage: UsageStatus) => void): () => void {
  usageListeners.add(listener);
  return () => usageListeners.delete(listener);
}

export function rememberUsage(usage: UsageStatus): UsageStatus {
  latestUsage = usage;
  usageFetchedAt = Date.now();
  usageListeners.forEach((listener) => listener(usage));
  return usage;
}

export class BillingApiError extends Error {
  code?: string;
  usage?: UsageStatus;

  constructor(message: string, code?: string, usage?: UsageStatus) {
    super(message);
    this.name = 'BillingApiError';
    this.code = code;
    this.usage = usage;
  }
}

export async function getInstallationId(): Promise<string> {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const existing = await SecureStore.getItemAsync(INSTALLATION_ID_KEY);
      if (existing) return existing;
      const created = Crypto.randomUUID();
      await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created);
      return created;
    })().catch((error) => {
      installationIdPromise = null;
      throw error;
    });
  }
  return installationIdPromise;
}

async function requestApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!API_BASE_URL) {
    throw new BillingApiError('Brak EXPO_PUBLIC_AI_API_URL. Ustaw adres backendu w .env i uruchom ponownie Expo.');
  }

  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BillingApiError(`Nie można połączyć się z backendem (${API_BASE_URL}). Sprawdź serwer i sieć Wi-Fi.`);
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; code?: string; usage?: UsageStatus })
    | null;

  if (!response.ok) {
    throw new BillingApiError(
      payload?.error || 'Nie udało się połączyć z usługą.',
      payload?.code,
      payload?.usage,
    );
  }
  if (!payload) throw new BillingApiError('Backend zwrócił nieprawidłową odpowiedź.');
  return payload;
}

export async function getUsage(options?: { fresh?: boolean }): Promise<UsageStatus> {
  if (!options?.fresh && latestUsage && Date.now() - usageFetchedAt < USAGE_TTL_MS) return latestUsage;
  if (!options?.fresh && usageRequest) return usageRequest;
  const request = (async () => {
    const installationId = await getInstallationId();
    return rememberUsage(await requestApi<UsageStatus>('/billing/usage', { installationId }));
  })();
  if (!options?.fresh) usageRequest = request;
  try {
    return await request;
  } finally {
    if (usageRequest === request) usageRequest = null;
  }
}

export async function createRewardRequest(): Promise<{ customData: string; userId: string }> {
  const installationId = await getInstallationId();
  return requestApi('/reward/start', { installationId });
}

export async function claimDevelopmentReward(customData: string): Promise<UsageStatus> {
  const installationId = await getInstallationId();
  return requestApi('/reward/dev-claim', { installationId, customData });
}

export async function waitForRewardCredit(timeoutMs = 25_000): Promise<UsageStatus> {
  const startedAt = Date.now();
  let currentUsage = await getUsage({ fresh: true });
  while (Date.now() - startedAt < timeoutMs && currentUsage.rewardCredits === 0) {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    currentUsage = await getUsage({ fresh: true });
  }
  return currentUsage;
}

export async function createPremiumCheckout(): Promise<{ checkoutUrl: string }> {
  if (!getAccessToken()) {
    throw new BillingApiError('Zaloguj się, aby kupić subskrypcję Premium.', 'AUTH_REQUIRED');
  }
  const installationId = await getInstallationId();
  return requestApi('/billing/checkout', { installationId });
}

export async function createBillingPortal(): Promise<{ portalUrl: string }> {
  if (!getAccessToken()) {
    throw new BillingApiError('Zaloguj się, aby zarządzać subskrypcją Premium.', 'AUTH_REQUIRED');
  }
  const installationId = await getInstallationId();
  return requestApi('/billing/portal', { installationId });
}
