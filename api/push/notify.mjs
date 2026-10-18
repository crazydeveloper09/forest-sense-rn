import { AuthError } from "../auth/errors.mjs";
import { getDb } from "../db/mongo.mjs";

const EXPO_TOKEN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

function assertToken(token) {
  if (!EXPO_TOKEN.test(String(token ?? ""))) {
    throw new AuthError("Nieprawidłowy token powiadomień.", 400, "INVALID_PUSH_TOKEN");
  }
  return String(token);
}

export async function registerPushToken(userId, body) {
  const token = assertToken(body?.token);
  const db = await getDb();
  await db.collection("push_tokens").updateOne(
    { token },
    { $set: { token, userId, updatedAt: new Date() } },
    { upsert: true },
  );
  return { ok: true };
}

export async function unregisterPushToken(userId, body) {
  const token = assertToken(body?.token);
  const db = await getDb();
  await db.collection("push_tokens").deleteOne({ token, userId });
  return { ok: true };
}

export async function notifyUser(userId, message) {
  try {
    const db = await getDb();
    const rows = await db.collection("push_tokens").find({ userId }).limit(20).toArray();
    if (!rows.length) return;
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(rows.map((row) => ({
        to: row.token,
        title: message.title,
        body: message.body,
        sound: "default",
        channelId: "trusted",
        data: message.data ?? {},
      }))),
    });
    const payload = await response.json().catch(() => null);
    const tickets = Array.isArray(payload?.data) ? payload.data : [];
    const stale = tickets
      .map((ticket, index) => (ticket?.details?.error === "DeviceNotRegistered" ? rows[index]?.token : null))
      .filter(Boolean);
    if (stale.length) await db.collection("push_tokens").deleteMany({ token: { $in: stale } });
  } catch (error) {
    console.error("Push failed:", error instanceof Error ? error.message : error);
  }
}
