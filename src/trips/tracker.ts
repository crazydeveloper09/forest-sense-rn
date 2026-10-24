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

const MIN_STEP_METERS = 8;
const MAX_WALK_METERS_PER_SECOND = 4.5;
const MAX_ACCURACY_METERS = 40;
const MIN_FIX_GAP_MS = 3000;

function persist(trip: StoredTrip): void {
  saveTrip({ ...trip, updatedAt: new Date().toISOString(), ownerId: trip.ownerId ?? getCurrentUserId() });
  emit();
}

function fixTime(position: Location.LocationObject, fallback: number): number {
  const stamp = Number(position.timestamp);
  return Number.isFinite(stamp) && stamp > 0 ? stamp : fallback;
}

function isGpsFix(position: Location.LocationObject): boolean {
  if (position.mocked) return false;
  const { accuracy, altitude } = position.coords;
  if (accuracy == null || accuracy > MAX_ACCURACY_METERS) return false;
  return altitude != null;
}

function isUsableFix(position: Location.LocationObject, previous: TripPoint | undefined, now: number): boolean {
  if (!isGpsFix(position)) return false;
  if (!previous) return true;
  const step = distanceMeters(previous, position.coords);
  if (step < MIN_STEP_METERS) return false;
  const elapsedMs = Math.max(now - Date.parse(previous.recordedAt), MIN_FIX_GAP_MS);
  return step / (elapsedMs / 1000) <= MAX_WALK_METERS_PER_SECOND;
}

async function ensureWatch(): Promise<void> {
  if (watch) return;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  watch = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 8,
      timeInterval: 3000,
      mayShowUserSettingsDialog: false,
    },
    (position) => {
      const trip = getActiveTrip();
      if (!trip) return;
      const now = fixTime(position, Date.now());
      if (now - lastFixAt < MIN_FIX_GAP_MS) return;
      const previous = trip.points[trip.points.length - 1];
      if (!isUsableFix(position, previous, now)) return;
      lastFixAt = now;
      const point: TripPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        recordedAt: new Date(now).toISOString(),
      };
      const step = previous ? distanceMeters(previous, point) : 0;
      persist({
        ...trip,
        distanceMeters: trip.distanceMeters + step,
        points: [...trip.points, point].slice(-2000),
      });
    },
  );
}

async function readStartPoint(
  origin: { latitude: number; longitude: number } | null | undefined,
  recordedAt: string,
): Promise<TripPoint | null> {
  if (origin && Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude)) {
    return { latitude: origin.latitude, longitude: origin.longitude, recordedAt };
  }
  const last = await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: 80 }).catch(() => null);
  if (!last) return null;
  return { latitude: last.coords.latitude, longitude: last.coords.longitude, recordedAt };
}

export async function startTrip(origin?: { latitude: number; longitude: number } | null): Promise<StoredTrip> {
  const existing = getActiveTrip();
  if (existing) {
    await ensureWatch();
    return existing;
  }
  const now = new Date().toISOString();
  const start = await readStartPoint(origin, now);
  const trip: StoredTrip = {
    clientId: Crypto.randomUUID(),
    startedAt: now,
    endedAt: null,
    mushroomCount: 0,
    distanceMeters: 0,
    points: start ? [start] : [],
    updatedAt: now,
    dirty: 1,
    deleted: 0,
    ownerId: getCurrentUserId(),
  };
  persist(trip);
  lastFixAt = Date.now();
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
