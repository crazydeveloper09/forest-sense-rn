import { getAccessToken } from '../auth/session';
import { getActiveTrip, subscribeTrips, type StoredTrip } from '../db';

export type LivePeer = {
  userId: string;
  label: string;
  points: Array<{ latitude: number; longitude: number }>;
};

type Listener = () => void;
const listeners = new Set<Listener>();
const peers = new Map<string, LivePeer>();

let socket: WebSocket | null = null;
let label = '';
let retryMs = 2000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeTrips: (() => void) | null = null;
let lastSent = '';
let opened = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getLivePeers(): LivePeer[] {
  return [...peers.values()];
}

export function subscribeLivePeers(listener: Listener): () => void {
  listeners.add(listener);
  listener();
  return () => listeners.delete(listener);
}

function liveUrl(): string | null {
  const base = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base.replace(/^http/, 'ws')}/live`;
}

function send(message: Record<string, unknown>): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function publishActiveTrip(): void {
  const trip: StoredTrip | null = getActiveTrip();
  if (!trip) {
    if (lastSent) {
      lastSent = '';
      send({ type: 'stop' });
    }
    return;
  }
  const point = trip.points[trip.points.length - 1];
  if (!point) return;
  const stamp = `${trip.clientId}:${point.latitude}:${point.longitude}:${trip.mushroomCount}`;
  if (stamp === lastSent) return;
  lastSent = stamp;
  send({
    type: 'position',
    tripId: trip.clientId,
    label,
    latitude: point.latitude,
    longitude: point.longitude,
    mushroomCount: trip.mushroomCount,
    distanceMeters: trip.distanceMeters,
  });
}

function applyMessage(message: {
  type?: string;
  userId?: string;
  label?: string;
  point?: { latitude: number; longitude: number };
  points?: Array<{ latitude: number; longitude: number }>;
}): void {
  if (!message.userId) return;
  if (message.type === 'peer-left') {
    peers.delete(message.userId);
    emit();
    return;
  }
  if (message.type === 'peer-trail' && Array.isArray(message.points)) {
    peers.set(message.userId, {
      userId: message.userId,
      label: message.label || 'Zaufana osoba',
      points: message.points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)),
    });
    emit();
    return;
  }
  if (message.type === 'peer' && message.point && Number.isFinite(message.point.latitude) && Number.isFinite(message.point.longitude)) {
    const current = peers.get(message.userId) ?? { userId: message.userId, label: message.label || 'Zaufana osoba', points: [] };
    const last = current.points[current.points.length - 1];
    const points = !last || last.latitude !== message.point.latitude || last.longitude !== message.point.longitude
      ? [...current.points, message.point].slice(-500)
      : current.points;
    peers.set(message.userId, { ...current, label: message.label || current.label, points });
    emit();
  }
}

function connect(): void {
  const url = liveUrl();
  const token = getAccessToken();
  if (!opened || !url || !token) return;
  const previous = socket;
  const next = new WebSocket(url);
  socket = next;
  previous?.close();
  next.onopen = () => {
    retryMs = 2000;
    next.send(JSON.stringify({ type: 'auth', token }));
    lastSent = '';
    publishActiveTrip();
  };
  next.onmessage = (event) => {
    try {
      applyMessage(JSON.parse(String(event.data)));
    } catch {
      // Ignore a malformed live frame. The next position still arrives.
    }
  };
  next.onclose = () => {
    if (socket !== next) return;
    socket = null;
    if (!opened) return;
    retryTimer = setTimeout(connect, retryMs);
    retryMs = Math.min(retryMs * 2, 15_000);
  };
}

export function connectLive(displayName: string): void {
  label = displayName.trim() || 'Zaufana osoba';
  if (opened) return;
  opened = true;
  unsubscribeTrips = subscribeTrips(publishActiveTrip);
  connect();
}

export function disconnectLive(): void {
  opened = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  unsubscribeTrips?.();
  unsubscribeTrips = null;
  socket?.close();
  socket = null;
  lastSent = '';
  if (peers.size) {
    peers.clear();
    emit();
  }
}
