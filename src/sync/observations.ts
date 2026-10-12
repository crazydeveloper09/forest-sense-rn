import { useEffect, useState } from 'react';
import { ApiError, postJson } from '../api/http';
import { getCachedUsage } from '../billing';
import { clearSession, getAccessToken, getCurrentUserId, getDataKey } from '../auth/session';
import { decryptUtf8, encryptUtf8 } from '../crypto/e2e';
import {
  claimUnownedObservations,
  getDirtyObservations,
  notifyObservations,
  upsertRemoteObservation,
  type SyncObservation,
} from '../db';

type RemoteObservation = {
  clientId: string;
  ciphertext: string;
  iv: string;
  updatedAt: string;
  deleted: boolean;
};

type SyncState = {
  status: 'idle' | 'syncing' | 'offline' | 'error';
  lastError: string | null;
  lastSyncedAt: string | null;
};

let state: SyncState = { status: 'idle', lastError: null, lastSyncedAt: null };
let running = false;
let queued = false;
const listeners = new Set<(next: SyncState) => void>();

function setSyncState(next: SyncState): void {
  state = next;
  listeners.forEach((listener) => listener(next));
}

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(listener: (next: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSyncStatus(): SyncState {
  const [current, setCurrent] = useState(state);
  useEffect(() => subscribeSync(setCurrent), []);
  return current;
}

function observationPayload(row: SyncObservation): string {
  return JSON.stringify({
    name: row.name,
    probability: row.probability,
    notes: row.notes,
    latitude: row.latitude,
    longitude: row.longitude,
    createdAt: row.createdAt,
  });
}

function readPayload(plain: string): Omit<SyncObservation, 'clientId' | 'updatedAt' | 'deleted'> | null {
  try {
    const value = JSON.parse(plain) as {
      name?: unknown;
      probability?: unknown;
      notes?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      createdAt?: unknown;
    };
    const probability = Number(value.probability);
    if (typeof value.name !== 'string' || typeof value.createdAt !== 'string') return null;
    if (!Number.isInteger(probability) || probability < 0 || probability > 100) return null;
    return {
      name: value.name.slice(0, 200),
      probability,
      notes: typeof value.notes === 'string' ? value.notes.slice(0, 4000) : '',
      latitude: typeof value.latitude === 'number' ? value.latitude : null,
      longitude: typeof value.longitude === 'number' ? value.longitude : null,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

async function isOnline(): Promise<boolean> {
  try {
    const Network = await import('expo-network');
    const network = await Network.getNetworkStateAsync();
    if (!network.isConnected || network.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}

function canSyncObservations(): boolean {
  return Boolean(getAccessToken() && getDataKey() && getCurrentUserId() && getCachedUsage()?.plan === 'premium');
}

export async function syncObservations(): Promise<void> {
  const token = getAccessToken();
  const dataKey = getDataKey();
  const userId = getCurrentUserId();
  if (!token || !dataKey || !userId || !canSyncObservations()) return;
  if (running) {
    queued = true;
    return;
  }

  running = true;
  try {
    if (!(await isOnline())) {
      setSyncState({ status: 'offline', lastError: null, lastSyncedAt: state.lastSyncedAt });
      return;
    }

    setSyncState({ status: 'syncing', lastError: null, lastSyncedAt: state.lastSyncedAt });
    claimUnownedObservations(userId);
    const dirty = getDirtyObservations(userId);
    const changes = dirty.map((row) => {
      const sealed = encryptUtf8(observationPayload(row), dataKey);
      return {
        clientId: row.clientId,
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        updatedAt: row.updatedAt,
        deleted: row.deleted === 1,
      };
    });
    const response = await postJson<{ records: RemoteObservation[] }>('/sync/observations', { changes }, true);
    for (const record of response.records) {
      if (record.deleted) {
        upsertRemoteObservation({
          clientId: record.clientId,
          name: 'Usunięta obserwacja',
          probability: 0,
          notes: '',
          latitude: null,
          longitude: null,
          createdAt: record.updatedAt,
          updatedAt: record.updatedAt,
          deleted: 1,
          ownerId: userId,
        });
        continue;
      }
      let plain = '';
      try {
        plain = decryptUtf8(record.ciphertext, record.iv, dataKey);
      } catch {
        continue;
      }
      const payload = readPayload(plain);
      if (!payload) continue;
      upsertRemoteObservation({
        ...payload,
        clientId: record.clientId,
        updatedAt: record.updatedAt,
        deleted: 0,
        ownerId: userId,
      });
    }
    notifyObservations();
    setSyncState({ status: 'idle', lastError: null, lastSyncedAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearSession();
      setSyncState({
        status: 'error',
        lastError: 'Sesja wygasła. Zaloguj się ponownie.',
        lastSyncedAt: state.lastSyncedAt,
      });
      return;
    }
    if (error instanceof ApiError && error.code === 'NETWORK') {
      setSyncState({ status: 'offline', lastError: null, lastSyncedAt: state.lastSyncedAt });
      return;
    }
    setSyncState({
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Synchronizacja nie powiodła się.',
      lastSyncedAt: state.lastSyncedAt,
    });
  } finally {
    running = false;
    if (queued) {
      queued = false;
      void syncObservations();
    }
  }
}

function isReachable(network: { isConnected?: boolean; isInternetReachable?: boolean | null }): boolean {
  return Boolean(network.isConnected) && network.isInternetReachable !== false;
}

export function startAutoSync(): () => void {
  let stopped = false;
  let wasOffline = false;
  let subscription: { remove: () => void } | undefined;

  const onNetwork = (network: { isConnected?: boolean; isInternetReachable?: boolean | null }) => {
    if (stopped) return;
    if (!isReachable(network)) {
      wasOffline = true;
      return;
    }
    if (!wasOffline) return;
    wasOffline = false;
    void syncObservations().finally(() => {
      if (!stopped && state.status === 'offline') wasOffline = true;
    });
  };

  void import('expo-network')
    .then(async (Network) => {
      if (stopped) return;
      const current = await Network.getNetworkStateAsync();
      if (!isReachable(current)) wasOffline = true;
      if (stopped) return;
      subscription = Network.addNetworkStateListener(onNetwork);
      if (stopped) subscription.remove();
    })
    .catch(() => undefined);

  return () => {
    stopped = true;
    subscription?.remove();
  };
}
