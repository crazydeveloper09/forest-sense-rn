import { WebSocketServer } from "ws";
import { AuthError } from "../auth/errors.mjs";
import { accountBilling, userFromAccessToken } from "../auth/service.mjs";
import { getDb } from "../db/mongo.mjs";

const AUTH_MS = 8_000;
const POINT_GAP_MS = 3_000;
const OFFLINE_MS = 120_000;
const MAX_POINTS = 500;
const trustCache = new Map();

function finitePoint(value) {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 85 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

async function acceptedPeers(userId) {
  const cached = trustCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.ids;
  const db = await getDb();
  const records = await db.collection("trust_requests").find({
    status: "accepted",
    $or: [{ fromUserId: userId }, { toUserId: userId }],
  }).toArray();
  const ids = records.map((record) => (record.fromUserId === userId ? record.toUserId : record.fromUserId));
  trustCache.set(userId, { ids, expiresAt: Date.now() + 20_000 });
  return ids;
}

export function attachLiveTrips(server) {
  const sockets = new WebSocketServer({ noServer: true });
  const presence = new Map();

  function send(socket, message) {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
  }

  function trailMessage(entry) {
    if (!entry?.tripId || !entry.points.length) return null;
    return {
      type: "peer-trail",
      userId: entry.userId,
      label: entry.label,
      tripId: entry.tripId,
      points: entry.points,
      mushroomCount: entry.mushroomCount,
      distanceMeters: entry.distanceMeters,
    };
  }

  async function deliver(fromUserId, message) {
    try {
      const peerIds = await acceptedPeers(fromUserId);
      for (const peerId of peerIds) {
        const peer = presence.get(peerId);
        if (!peer) continue;
        for (const socket of peer.sockets) send(socket, message);
      }
    } catch (error) {
      console.error("Live delivery failed:", error instanceof Error ? error.message : error);
    }
  }

  function forget(userId) {
    const entry = presence.get(userId);
    if (!entry) return;
    clearTimeout(entry.offlineTimer);
    presence.delete(userId);
    void deliver(userId, { type: "peer-left", userId });
  }

  server.on("upgrade", (request, socket, head) => {
    let pathname = "/";
    try {
      pathname = new URL(request.url || "/", "http://localhost").pathname;
    } catch {
      socket.destroy();
      return;
    }
    if (pathname !== "/live") {
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws));
  });

  sockets.on("connection", (ws) => {
    let userId = null;
    const authTimer = setTimeout(() => {
      if (!userId) ws.close();
    }, AUTH_MS);

    ws.on("message", async (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        ws.close();
        return;
      }
      if (!userId) {
        if (message?.type !== "auth") {
          ws.close();
          return;
        }
        try {
          const user = await userFromAccessToken(message.token);
          const billing = await accountBilling(user.id);
          if (!billing || !(billing.premiumUntil > Date.now())) {
            ws.close();
            return;
          }
          userId = user.id;
          clearTimeout(authTimer);
          let entry = presence.get(userId);
          if (!entry) {
            entry = { userId, sockets: new Set(), label: "", tripId: null, points: [], mushroomCount: 0, distanceMeters: 0, updatedAt: 0, offlineTimer: null };
            presence.set(userId, entry);
          }
          clearTimeout(entry.offlineTimer);
          entry.sockets.add(ws);
          const peerIds = await acceptedPeers(userId);
          for (const peerId of peerIds) {
            const trail = trailMessage(presence.get(peerId));
            if (trail) send(ws, trail);
          }
        } catch (error) {
          if (!(error instanceof AuthError)) console.error("Live auth failed:", error);
          ws.close();
        }
        return;
      }

      const entry = presence.get(userId);
      if (!entry) return;
      if (message?.type === "stop") {
        entry.tripId = null;
        entry.points = [];
        void deliver(userId, { type: "peer-left", userId });
        return;
      }
      if (message?.type !== "position") return;
      const point = finitePoint(message);
      if (!point || typeof message.tripId !== "string") return;
      const now = Date.now();
      if (entry.tripId === message.tripId && now - entry.updatedAt < POINT_GAP_MS) return;
      entry.updatedAt = now;
      entry.tripId = message.tripId;
      entry.label = typeof message.label === "string" && message.label.trim() ? message.label.trim().slice(0, 80) : "Zaufana osoba";
      entry.mushroomCount = Math.max(0, Math.round(Number(message.mushroomCount) || 0));
      entry.distanceMeters = Math.max(0, Number(message.distanceMeters) || 0);
      const previous = entry.points[entry.points.length - 1];
      if (!previous || previous.latitude !== point.latitude || previous.longitude !== point.longitude) {
        entry.points.push(point);
        if (entry.points.length > MAX_POINTS) entry.points.shift();
      }
      void deliver(userId, {
        type: "peer",
        userId,
        label: entry.label,
        tripId: entry.tripId,
        point,
        mushroomCount: entry.mushroomCount,
        distanceMeters: entry.distanceMeters,
      });
    });

    ws.on("close", () => {
      clearTimeout(authTimer);
      if (!userId) return;
      const entry = presence.get(userId);
      if (!entry) return;
      entry.sockets.delete(ws);
      if (entry.sockets.size > 0) return;
      entry.offlineTimer = setTimeout(() => forget(userId), OFFLINE_MS);
    });
  });
}
