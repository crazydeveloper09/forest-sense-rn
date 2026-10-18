import { MongoClient } from "mongodb";
import { AuthError } from "../auth/errors.mjs";

let clientPromise;

async function ensureIndexes(db) {
  await db.collection("users").createIndex({ emailLookup: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("mfa_challenges").createIndex({ tokenHash: 1 }, { unique: true });
  await db
    .collection("mfa_challenges")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db
    .collection("observations")
    .createIndex({ userId: 1, clientId: 1 }, { unique: true });
  await db.collection("push_tokens").createIndex({ token: 1 }, { unique: true });
  await db.collection("push_tokens").createIndex({ userId: 1 });
}

export function getDb() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new AuthError(
      "Baza MongoDB nie jest skonfigurowana. Ustaw MONGODB_URI.",
      503,
      "MONGO_NOT_CONFIGURED",
    );
  }
  if (!clientPromise) {
    const client = new MongoClient(uri);
    clientPromise = client
      .connect()
      .then(async (connected) => {
        const db = connected.db(process.env.MONGODB_DB?.trim() || "forest_sense");
        await ensureIndexes(db);
        return db;
      })
      .catch((error) => {
        clientPromise = undefined;
        if (error instanceof AuthError) throw error;
        console.error(
          "MongoDB connection failed:",
          error instanceof Error ? error.message : "unknown error",
        );
        throw new AuthError(
          "Nie można połączyć się z bazą MongoDB.",
          503,
          "MONGO_UNAVAILABLE",
        );
      });
  }
  return clientPromise;
}
