import { postJson } from '../api/http';
import { getAccessToken, getCurrentUserId, getDataKey } from '../auth/session';
import { decryptUtf8, encryptUtf8 } from '../crypto/e2e';
import {
  claimUnownedTrips,
  getDirtyTrips,
  upsertRemoteTrip,
  type StoredTrip,
  type TripPoint,
} from '../db';

type RemoteTrip = {
  clientId: string;
  ciphertext: string;
  iv: string;
  updatedAt: string;
  deleted: boolean;
};

function thin(points: TripPoint[]): TripPoint[] {
  if (points.length <= 400) return points;
  const stride = Math.ceil(points.length / 400);
  const sampled = points.filter((_, index) => index % stride === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}

function payload(trip: StoredTrip): string {
  return JSON.stringify({
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    mushroomCount: trip.mushroomCount,
    distanceMeters: trip.distanceMeters,
    points: thin(trip.points),
  });
}

function readPayload(plain: string): Omit<StoredTrip, 'clientId' | 'updatedAt' | 'dirty' | 'deleted' | 'ownerId'> | null {
  try {
    const value = JSON.parse(plain) as {
      startedAt?: unknown;
      endedAt?: unknown;
      mushroomCount?: unknown;
      distanceMeters?: unknown;
      points?: unknown;
    };
    if (typeof value.startedAt !== 'string') return null;
    const points = Array.isArray(value.points)
      ? value.points.flatMap((point) => {
        if (!point || typeof point !== 'object') return [];
        const record = point as TripPoint;
        if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) return [];
        return [{
          latitude: record.latitude,
          longitude: record.longitude,
          recordedAt: typeof record.recordedAt === 'string' ? record.recordedAt : value.startedAt as string,
        }];
      })
      : [];
    return {
      startedAt: value.startedAt,
      endedAt: typeof value.endedAt === 'string' ? value.endedAt : null,
      mushroomCount: Math.max(0, Math.round(Number(value.mushroomCount) || 0)),
      distanceMeters: Math.max(0, Number(value.distanceMeters) || 0),
      points,
    };
  } catch {
    return null;
  }
}

export async function syncTrips(): Promise<void> {
  const token = getAccessToken();
  const dataKey = getDataKey();
  const userId = getCurrentUserId();
  if (!token || !dataKey || !userId) return;
  claimUnownedTrips(userId);
  const changes = getDirtyTrips(userId).map((trip) => {
    const sealed = encryptUtf8(payload(trip), dataKey);
    return {
      clientId: trip.clientId,
      ciphertext: sealed.ciphertext,
      iv: sealed.iv,
      updatedAt: trip.updatedAt,
      deleted: trip.deleted === 1,
    };
  });
  const response = await postJson<{ records: RemoteTrip[] }>('/sync/trips', { changes }, true);
  for (const record of response.records) {
    if (record.deleted) {
      upsertRemoteTrip({
        clientId: record.clientId,
        startedAt: record.updatedAt,
        endedAt: record.updatedAt,
        mushroomCount: 0,
        distanceMeters: 0,
        points: [],
        updatedAt: record.updatedAt,
        dirty: 0,
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
    const parsed = readPayload(plain);
    if (!parsed) continue;
    upsertRemoteTrip({
      ...parsed,
      clientId: record.clientId,
      updatedAt: record.updatedAt,
      dirty: 0,
      deleted: 0,
      ownerId: userId,
    });
  }
}
