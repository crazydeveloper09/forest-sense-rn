import { AuthError } from "../auth/errors.mjs";
import { getDb } from "../db/mongo.mjs";

const MAX_CHANGES = 40;
const MAX_CIPHERTEXT = 80_000;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertChange(change) {
  if (!change || !UUID_V4.test(change.clientId ?? "")) {
    throw new AuthError("Nieprawidłowy identyfikator wyprawy.", 400, "INVALID_TRIP");
  }
  const updatedAt = Date.parse(change.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt > Date.now() + 5 * 60 * 1000) {
    throw new AuthError("Nieprawidłowa data wyprawy.", 400, "INVALID_TRIP");
  }
  if (typeof change.ciphertext !== "string" || typeof change.iv !== "string") {
    throw new AuthError("Wyprawa nie jest zaszyfrowana.", 400, "INVALID_CIPHERTEXT");
  }
  if (change.ciphertext.length > MAX_CIPHERTEXT || change.iv.length > 64) {
    throw new AuthError("Zaszyfrowana wyprawa jest za duża.", 413, "CIPHERTEXT_TOO_LARGE");
  }
  const iv = Buffer.from(change.iv, "base64");
  const body = Buffer.from(change.ciphertext, "base64");
  if (iv.length !== 12 || body.length < 16) {
    throw new AuthError("Nieprawidłowy szyfrogram wyprawy.", 400, "INVALID_CIPHERTEXT");
  }
  return {
    clientId: change.clientId.toLowerCase(),
    ciphertext: change.ciphertext,
    iv: change.iv,
    updatedAt: new Date(updatedAt).toISOString(),
    deleted: Boolean(change.deleted),
  };
}

export async function syncTrips(userId, body) {
  const changes = body?.changes ?? [];
  if (!Array.isArray(changes) || changes.length > MAX_CHANGES) {
    throw new AuthError("Można wysłać najwyżej 40 wypraw naraz.", 400, "TOO_MANY_CHANGES");
  }
  const db = await getDb();
  const collection = db.collection("trips");
  for (const rawChange of changes) {
    const change = assertChange(rawChange);
    const existing = await collection.findOne(
      { userId, clientId: change.clientId },
      { projection: { updatedAt: 1 } },
    );
    if (existing && existing.updatedAt > change.updatedAt) continue;
    await collection.updateOne(
      { userId, clientId: change.clientId },
      {
        $set: {
          ciphertext: change.ciphertext,
          iv: change.iv,
          updatedAt: change.updatedAt,
          deleted: change.deleted,
        },
        $setOnInsert: { userId, clientId: change.clientId, createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  const records = await collection.find({ userId }).sort({ updatedAt: 1 }).toArray();
  return {
    records: records.map((record) => ({
      clientId: record.clientId,
      ciphertext: record.ciphertext,
      iv: record.iv,
      updatedAt: record.updatedAt,
      deleted: Boolean(record.deleted),
    })),
  };
}
