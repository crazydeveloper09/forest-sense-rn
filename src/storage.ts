import { getObservations, initDatabase, addObservation, subscribeObservations } from './db';
import { scheduleObservationSync } from './sync/observations';
import type { ObservationRecord, SubscriptionTier } from './types';

export function initializeAppStorage(): void {
  initDatabase();
}

export function getOfflineObservations(ownerId?: string | null): ObservationRecord[] {
  return getObservations(ownerId);
}

export function subscribeOfflineObservations(listener: () => void): () => void {
  return subscribeObservations(listener);
}

export function saveObservation(
  name: string,
  probability: number,
  notes: string,
  latitude?: number,
  longitude?: number,
): void {
  addObservation(name, probability, notes, latitude, longitude);
  scheduleObservationSync();
}

export function getSubscriptionTier(): SubscriptionTier {
  return 'free';
}
