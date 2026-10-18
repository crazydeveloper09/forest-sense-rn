import * as Crypto from 'expo-crypto';
import * as Location from 'expo-location';
import { getCurrentUserId } from '../auth/session';
import { getActiveTrip, saveTrip, type StoredTrip, type TripPoint } from '../db';

type Listener = () => void;
const listeners = new Set<Listener>();
let watch: Location.LocationSubscription | null = null;
let lastFixAt = 0;

export function subscribeActiveTrip(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

function distanceMeters(from: TripPoint, to: Pick<TripPoint, 'latitude' | 'longitude'>): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function persist(trip: StoredTrip): void {
  saveTrip({ ...trip, updatedAt: new Date().toISOString(), ownerId: trip.ownerId ?? getCurrentUserId() });
  emit();
}

async function ensureWatch(): Promise<void> {
  if (watch) return;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  watch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 12, timeInterval: 5000 },
    (position) => {
      const trip = getActiveTrip();
      if (!trip) return;
      const now = Date.now();
      if (now - lastFixAt < 4000) return;
      lastFixAt = now;
      const point: TripPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        recordedAt: new Date(position.timestamp).toISOString(),
      };
      const previous = trip.points[trip.points.length - 1];
      const step = previous ? distanceMeters(previous, point) : 0;
      if (previous && step < 8) return;
      persist({
        ...trip,
        distanceMeters: trip.distanceMeters + step,
        points: [...trip.points, point].slice(-2000),
      });
    },
  );
}

export async function startTrip(origin?: { latitude: number; longitude: number } | null): Promise<StoredTrip> {
  const existing = getActiveTrip();
  if (existing) {
    await ensureWatch();
    return existing;
  }
  const now = new Date().toISOString();
  const trip: StoredTrip = {
    clientId: Crypto.randomUUID(),
    startedAt: now,
    endedAt: null,
    mushroomCount: 0,
    distanceMeters: 0,
    points: origin ? [{ ...origin, recordedAt: now }] : [],
    updatedAt: now,
    dirty: 1,
    deleted: 0,
    ownerId: getCurrentUserId(),
  };
  persist(trip);
  await ensureWatch();
  return trip;
}

export function changeMushroomCount(delta: number): StoredTrip | null {
  const trip = getActiveTrip();
  if (!trip) return null;
  const next = { ...trip, mushroomCount: Math.max(0, trip.mushroomCount + delta) };
  persist(next);
  return next;
}

export function finishTrip(): StoredTrip | null {
  const trip = getActiveTrip();
  if (!trip) return null;
  const next = { ...trip, endedAt: new Date().toISOString() };
  persist(next);
  watch?.remove();
  watch = null;
  return next;
}

export function resumeActiveTrip(): void {
  if (getActiveTrip()) void ensureWatch();
}
