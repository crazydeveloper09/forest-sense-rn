import Stripe from "stripe";
import { recordSubscriptionOwner } from "../auth/service.mjs";
import { MonetizationError } from "./errors.mjs";
import {
  getRecord,
  premiumActive,
  updateSubscription,
  validateInstallationId,
} from "./usage-store.mjs";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
const PREMIUM_TAX_CODE = process.env.STRIPE_PREMIUM_TAX_CODE || "txcd_10103100";

function stripeClient() {
  if (!stripe)
    throw new MonetizationError(
      "Stripe nie jest skonfigurowany na serwerze.",
      503,
      "STRIPE_NOT_CONFIGURED",
    );
  return stripe;
}

function assertAccountUser(accountUserId) {
  if (typeof accountUserId !== "string" || !/^[a-f0-9]{24}$/i.test(accountUserId)) {
    throw new MonetizationError(
      "Zaloguj się, aby kupić subskrypcję Premium.",
      401,
      "AUTH_REQUIRED",
    );
  }
  return accountUserId;
}

async function rememberOwner(userId, subscription) {
  if (!userId) return;
  try {
    await recordSubscriptionOwner(userId, subscription);
  } catch (error) {
    console.error(
      "Could not store subscription owner:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
}

function publicApiUrl() {
  const baseUrl = process.env.PUBLIC_API_URL?.replace(/\/$/, "");
  if (!baseUrl)
    throw new MonetizationError(
      "Ustaw HTTPS w PUBLIC_API_URL przed uruchomieniem płatności.",
      503,
      "STRIPE_RETURN_URL_MISSING",
    );
  return baseUrl;
}

export async function createPremiumCheckout(installationId, accountUserId) {
  const id = validateInstallationId(installationId);
  const userId = assertAccountUser(accountUserId);
  if (premiumActive(getRecord(id)))
    throw new MonetizationError(
      "Subskrypcja Premium jest już aktywna.",
      409,
      "ALREADY_PREMIUM",
    );

  const baseUrl = publicApiUrl();
  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "pln",
          unit_amount: 1500,
          recurring: { interval: "month" },
          product_data: {
            name: "Forest Sense Premium",
            tax_code: PREMIUM_TAX_CODE,
          },
        },
        quantity: 1,
      },
    ],
    client_reference_id: id,
    metadata: { installationId: id, userId },
    subscription_data: { metadata: { installationId: id, userId } },
    success_url: `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/stripe/cancel`,
  });
  if (!session.url)
    throw new MonetizationError(
      "Stripe nie zwrócił adresu płatności.",
      502,
      "STRIPE_SESSION_FAILED",
    );
  return { checkoutUrl: session.url };
}

export async function createBillingPortal(installationId, accountUserId) {
  const id = validateInstallationId(installationId);
  assertAccountUser(accountUserId);
  const record = getRecord(id);
  if (!record.stripeCustomerId)
    throw new MonetizationError(
      "Nie znaleziono klienta Stripe dla tej instalacji.",
      404,
      "STRIPE_CUSTOMER_NOT_FOUND",
    );
  const session = await stripeClient().billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: `${publicApiUrl()}/stripe/cancel`,
  });
  return { portalUrl: session.url };
}

export async function applyStripeEvent(event) {
  const api = stripeClient();
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const installationId = session.metadata?.installationId;
    if (installationId && session.subscription) {
      const subscription = await api.subscriptions.retrieve(
        session.subscription,
      );
      updateSubscription(installationId, subscription);
      await rememberOwner(session.metadata?.userId, subscription);
    }
  }
  if (event.type.startsWith("customer.subscription.")) {
    const subscription = event.data.object;
    const installationId = subscription.metadata?.installationId;
    if (installationId) updateSubscription(installationId, subscription);
    await rememberOwner(subscription.metadata?.userId, subscription);
  }
}

export async function completeStripeCheckout(sessionId) {
  if (typeof sessionId !== "string" || !sessionId.startsWith("cs_"))
    return false;
  const api = stripeClient();
  const session = await api.checkout.sessions.retrieve(sessionId);
  if (
    session.status !== "complete" ||
    !["paid", "no_payment_required"].includes(session.payment_status)
  )
    return false;
  const installationId = session.metadata?.installationId;
  if (!installationId || !session.subscription) return false;
  const subscription = await api.subscriptions.retrieve(session.subscription);
  updateSubscription(installationId, subscription);
  await rememberOwner(session.metadata?.userId, subscription);
  return true;
}

export function constructStripeEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret)
    throw new MonetizationError(
      "Stripe webhook nie ma skonfigurowanego sekretu.",
      503,
      "STRIPE_WEBHOOK_NOT_CONFIGURED",
    );
  return stripeClient().webhooks.constructEvent(rawBody, signature, secret);
}
