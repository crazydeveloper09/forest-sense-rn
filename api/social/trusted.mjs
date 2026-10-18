import { randomUUID } from "node:crypto";
import { AuthError } from "../auth/errors.mjs";
import { accountBilling } from "../auth/service.mjs";
import { getDb } from "../db/mongo.mjs";
import { notifyUser } from "../push/notify.mjs";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function labelOf(value) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

async function assertPremium(userId) {
  const billing = await accountBilling(userId);
  if (!billing || !(billing.premiumUntil > Date.now())) {
    throw new AuthError("Zaufani użytkownicy są dostępni w Premium.", 403, "PREMIUM_REQUIRED");
  }
}

function publicRequest(record, userId) {
  const outgoing = record.fromUserId === userId;
  return {
    id: record.id,
    userId: outgoing ? record.toUserId : record.fromUserId,
    status: record.status,
    label: outgoing ? record.toLabel : record.fromLabel,
    direction: outgoing ? "outgoing" : "incoming",
  };
}

export async function inviteTrustedUser(userId, body) {
  await assertPremium(userId);
  const emailLookup = String(body?.emailLookup ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(emailLookup)) {
    throw new AuthError("Podaj adres e-mail zaufanej osoby.", 400, "INVALID_EMAIL");
  }
  const db = await getDb();
  const target = await db.collection("users").findOne({ emailLookup });
  if (!target) throw new AuthError("Nie ma konta z tym adresem.", 404, "USER_NOT_FOUND");
  const toUserId = target._id.toHexString();
  if (toUserId === userId) throw new AuthError("Nie możesz dodać samego siebie.", 400, "SELF_TRUST");
  const existing = await db.collection("trust_requests").findOne({ fromUserId: userId, toUserId });
  if (existing && existing.status !== "declined") return { request: publicRequest(existing, userId) };
  const now = new Date().toISOString();
  const request = {
    id: existing?.id ?? randomUUID(),
    fromUserId: userId,
    toUserId,
    fromLabel: labelOf(body?.label) || "Użytkownik Forest Sense",
    toLabel: labelOf(body?.email),
    status: "pending",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await db.collection("trust_requests").updateOne(
    { fromUserId: userId, toUserId },
    { $set: request },
    { upsert: true },
  );
  void notifyUser(toUserId, {
    title: "Prośba o zaufanie",
    body: `${request.fromLabel} chce widzieć się z Tobą na wyprawie.`,
    data: { type: "trust-request" },
  });
  return { request: publicRequest(request, userId) };
}

export async function respondTrustedUser(userId, body) {
  await assertPremium(userId);
  const id = String(body?.id ?? "");
  if (!UUID_V4.test(id)) throw new AuthError("Nieprawidłowa prośba.", 400, "INVALID_REQUEST");
  const status = body?.accept === true ? "accepted" : "declined";
  const db = await getDb();
  const request = await db.collection("trust_requests").findOne({ id, toUserId: userId });
  if (!request) throw new AuthError("Nie znaleziono prośby.", 404, "REQUEST_NOT_FOUND");
  const updatedAt = new Date().toISOString();
  await db.collection("trust_requests").updateOne({ id }, { $set: { status, updatedAt } });
  if (status === "accepted" && request.status !== "accepted") {
    void notifyUser(request.fromUserId, {
      title: "Prośba zaakceptowana",
      body: "Zaufana osoba zaakceptowała prośbę. Podczas wyprawy widzicie się na mapie.",
      data: { type: "trust-accepted" },
    });
  }
  return { request: publicRequest({ ...request, status }, userId) };
}

export async function listTrustedUsers(userId) {
  await assertPremium(userId);
  const db = await getDb();
  const records = await db.collection("trust_requests").find({
    $or: [{ fromUserId: userId }, { toUserId: userId }],
  }).sort({ updatedAt: -1 }).toArray();
  return { requests: records.map((record) => publicRequest(record, userId)) };
}

function cleanPoints(points) {
  if (!Array.isArray(points) || points.length > 500) {
    throw new AuthError("Trasa wyprawy jest nieprawidłowa.", 400, "INVALID_ROUTE");
  }
  return points.map((point) => {
    const latitude = Number(point?.latitude);
    const longitude = Number(point?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 85 || Math.abs(longitude) > 180) {
      throw new AuthError("Trasa wyprawy ma nieprawidłowy punkt.", 400, "INVALID_ROUTE");
    }
    return {
      latitude,
      longitude,
      recordedAt: typeof point?.recordedAt === "string" ? point.recordedAt : new Date().toISOString(),
    };
  });
}

export async function shareTrip(userId, body) {
  await assertPremium(userId);
  const tripId = String(body?.tripId ?? "");
  const recipientUserId = String(body?.recipientUserId ?? "");
  if (!UUID_V4.test(tripId)) throw new AuthError("Nieprawidłowa wyprawa.", 400, "INVALID_TRIP");
  const db = await getDb();
  const trust = await db.collection("trust_requests").findOne({
    fromUserId: userId,
    toUserId: recipientUserId,
    status: "accepted",
  });
  if (!trust) throw new AuthError("Ta osoba nie zaakceptowała jeszcze prośby.", 403, "TRUST_REQUIRED");
  const share = {
    id: `${tripId}:${recipientUserId}`,
    tripId,
    ownerUserId: userId,
    recipientUserId,
    ownerLabel: labelOf(body?.ownerLabel) || trust.fromLabel,
    startedAt: typeof body?.startedAt === "string" ? body.startedAt : new Date().toISOString(),
    endedAt: typeof body?.endedAt === "string" ? body.endedAt : null,
    distanceMeters: Math.max(0, Number(body?.distanceMeters) || 0),
    mushroomCount: Math.max(0, Math.round(Number(body?.mushroomCount) || 0)),
    points: cleanPoints(body?.points),
    updatedAt: new Date().toISOString(),
  };
  await db.collection("trip_shares").updateOne({ id: share.id }, { $set: share }, { upsert: true });
  return { ok: true };
}

export async function inboxTrips(userId) {
  await assertPremium(userId);
  const db = await getDb();
  const shares = await db.collection("trip_shares").find({ recipientUserId: userId }).sort({ updatedAt: -1 }).limit(50).toArray();
  return {
    trips: shares.map((share) => ({
      id: share.id,
      tripId: share.tripId,
      ownerLabel: share.ownerLabel,
      startedAt: share.startedAt,
      endedAt: share.endedAt,
      distanceMeters: share.distanceMeters,
      mushroomCount: share.mushroomCount,
      points: share.points,
    })),
  };
}
