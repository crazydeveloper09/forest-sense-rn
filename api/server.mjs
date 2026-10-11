import { createServer } from "node:http";
import {
  MonetizationError,
  applyStripeEvent,
  claimDevelopmentReward,
  completeStripeCheckout,
  constructStripeEvent,
  createBillingPortal,
  createPremiumCheckout,
  getUsageStatus,
  grantPremiumFromAccount,
  refundRecognition,
  reserveRecognition,
  startReward,
  verifyAdmobCallback,
} from "./monetization.mjs";
import {
  identifyMushroomImage,
  isGeminiConfigured,
  MODEL_NAME,
} from "./gemini-identification.mjs";
import { handleAuthRequest, handleSyncRequest } from "./auth/routes.mjs";
import { AuthError } from "./auth/errors.mjs";
import {
  claimAccountDevelopmentReward,
  getAccountUsage,
  refundAccountRecognition,
  reserveAccountRecognition,
  startAccountReward,
} from "./auth/account-usage.mjs";
import { accountBilling, userFromRequest } from "./auth/service.mjs";
import { readJson, readRawBody, sendAppReturnPage, sendJson } from "./http.mjs";
import { privacyContext, sendView } from "./views.mjs";

const PORT = Number(process.env.PORT || process.env.AI_API_PORT || 8787);
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const STRIPE_BODY_LIMIT = 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function accountFromRequest(request) {
  if (!request.headers.authorization) return null;
  return userFromRequest(request);
}

async function usageForRequest(request, installationId) {
  const account = await accountFromRequest(request);
  if (!account) return getUsageStatus(installationId);
  return getAccountUsage(account.id, installationId);
}

async function refundAny(reservation) {
  if (reservation?.scope === "account") return refundAccountRecognition(reservation);
  refundRecognition(reservation);
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    });
    return response.end();
  }

  const url = new URL(request.url || "/", "http://localhost");
  if (
    request.method === "GET" &&
    (url.pathname === "/privacy" || url.pathname === "/polityka-prywatnosci")
  ) {
    return sendView(response, "privacy", privacyContext);
  }
  if (request.method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, {
      ok: true,
      provider: "Gemini",
      model: MODEL_NAME,
      configured: isGeminiConfigured,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      admobRewardSsvConfigured: Boolean(process.env.ADMOB_SSV_TOKEN_SECRET),
      accountsConfigured: Boolean(process.env.MONGODB_URI && process.env.DATA_ENCRYPTION_KEY),
    });
  }
  if (request.method === "GET" && url.pathname === "/stripe/success") {
    const complete = await completeStripeCheckout(
      url.searchParams.get("session_id"),
    );
    return sendAppReturnPage(response, complete ? "success" : "cancelled");
  }
  if (request.method === "GET" && url.pathname === "/stripe/cancel") {
    return sendAppReturnPage(response, "cancelled");
  }
  if (request.method === "GET" && url.pathname === "/admob/ssv") {
    await verifyAdmobCallback(request.url || "");
    response.writeHead(200, { "Cache-Control": "no-store" });
    return response.end("OK");
  }
  if (request.method === "POST" && url.pathname === "/stripe/webhook") {
    const rawBody = await readRawBody(request, STRIPE_BODY_LIMIT);
    const event = constructStripeEvent(
      rawBody,
      request.headers["stripe-signature"],
    );
    await applyStripeEvent(event);
    return sendJson(response, 200, { received: true });
  }
  if (await handleAuthRequest(request, response, url)) return;
  if (request.method !== "POST")
    return sendJson(response, 404, { error: "Nie znaleziono endpointu." });
  if (await handleSyncRequest(request, response, url)) return;

  if (url.pathname === "/billing/usage") {
    const body = await readJson(request, MAX_BODY_BYTES);
    return sendJson(response, 200, await usageForRequest(request, body.installationId));
  }
  if (url.pathname === "/billing/checkout") {
    const user = await userFromRequest(request);
    const body = await readJson(request, MAX_BODY_BYTES);
    grantPremiumFromAccount(body.installationId, await accountBilling(user.id));
    return sendJson(
      response,
      200,
      await createPremiumCheckout(body.installationId, user.id),
    );
  }
  if (url.pathname === "/billing/portal") {
    const user = await userFromRequest(request);
    const body = await readJson(request, MAX_BODY_BYTES);
    grantPremiumFromAccount(body.installationId, await accountBilling(user.id));
    return sendJson(
      response,
      200,
      await createBillingPortal(body.installationId, user.id),
    );
  }
  if (url.pathname === "/reward/start") {
    const body = await readJson(request, MAX_BODY_BYTES);
    const account = await accountFromRequest(request);
    return sendJson(
      response,
      200,
      account
        ? await startAccountReward(account.id, body.installationId)
        : startReward(body.installationId),
    );
  }
  if (url.pathname === "/reward/dev-claim") {
    const body = await readJson(request, MAX_BODY_BYTES);
    const account = await accountFromRequest(request);
    return sendJson(
      response,
      200,
      account
        ? await claimAccountDevelopmentReward(account.id, body.installationId, body.customData)
        : claimDevelopmentReward(body.installationId, body.customData),
    );
  }
  if (url.pathname !== "/identify")
    return sendJson(response, 404, { error: "Nie znaleziono endpointu." });
  if (!isGeminiConfigured) {
    return sendJson(response, 503, {
      error:
        "Serwer AI nie ma ustawionego GEMINI_API_KEY. Skonfiguruj klucz po stronie API.",
    });
  }

  const body = await readJson(request, MAX_BODY_BYTES);
  const imageBase64 =
    typeof body.imageBase64 === "string"
      ? body.imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
      : "";
  const mimeType = String(body.mimeType || "");
  if (!imageBase64 || !ALLOWED_MIME_TYPES.has(mimeType)) {
    return sendJson(response, 400, {
      error: "Nieprawidłowe zdjęcie. Obsługiwane formaty: JPEG, PNG i WebP.",
    });
  }
  if (imageBase64.length > MAX_BODY_BYTES) {
    return sendJson(response, 413, {
      error: "Zdjęcie jest za duże. Wybierz mniejszy plik.",
    });
  }

  const account = await accountFromRequest(request);
  const reservation = account
    ? await reserveAccountRecognition(account.id, body.installationId)
    : reserveRecognition(body.installationId);
  try {
    const identification = await identifyMushroomImage(imageBase64, mimeType);
    return sendJson(response, 200, {
      identification,
      usage: account
        ? await getAccountUsage(account.id, body.installationId)
        : getUsageStatus(body.installationId),
    });
  } catch (error) {
    await refundAny(reservation);
    throw error;
  }
}

function handleError(error, request, response) {
  if (error instanceof SyntaxError)
    return sendJson(response, 400, { error: "Nieprawidłowe żądanie JSON." });
  if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
    return sendJson(response, 413, {
      error: "Żądanie jest za duże. Zmniejsz zdjęcie lub spróbuj ponownie.",
    });
  }
  if (error instanceof AuthError || error?.code === "ENCRYPTION_KEY_MISSING") {
    return sendJson(response, error.status || 400, {
      error: error.message,
      code: error.code,
    });
  }
  if (error instanceof MonetizationError) {
    const usage =
      error.usage ??
      (error.code === "QUOTA_EXCEEDED" && error.scope !== "account"
        ? getUsageStatus(error.installationId)
        : undefined);
    return sendJson(response, error.status, {
      error: error.message,
      code: error.code,
      ...(usage ? { usage } : {}),
    });
  }
  if (request.url?.startsWith("/admob/ssv")) {
    console.error(
      "AdMob SSV callback rejected:",
      error instanceof Error ? error.message : "unknown error",
    );
    return sendJson(response, 400, {
      error: "Nie udało się zweryfikować nagrody AdMob.",
    });
  }
  if (error?.status === 429) {
    console.warn("Gemini rate limit reached; recognition quota was refunded.");
    return sendJson(response, 429, {
      error:
        "Limit zapytań dostawcy AI został osiągnięty. Spróbuj ponownie za chwilę.",
      code: "PROVIDER_RATE_LIMIT",
    });
  }
  if (error?.status === 404 || error?.status === 400) {
    return sendJson(response, 502, {
      error: `Model ${MODEL_NAME} nie jest dostępny dla tego klucza lub konfiguracji. Sprawdź GEMINI_MODEL i dostęp do Gemini API.`,
    });
  }
  console.error(
    "API request failed:",
    error instanceof Error ? error.message : "unknown error",
  );
  return sendJson(response, 502, {
    error:
      error instanceof Error
        ? error.message
        : "Nie udało się połączyć z usługą AI.",
  });
}

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) =>
    handleError(error, request, response),
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Forest Sense AI API listening on http://0.0.0.0:${PORT}`);
  if (!isGeminiConfigured)
    console.warn(
      "GEMINI_API_KEY is not configured. Set it in the server environment before identifying images.",
    );
});
