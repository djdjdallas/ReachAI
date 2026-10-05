import Stripe from "stripe";
import { PLAN_CATALOG, PLAN_IDS } from "@/lib/plans";

let _stripe;

export function getStripe() {
  if (!_stripe) {
    // 10s, not the SDK's 80s: a slow Stripe read in a webhook handler then
    // fails fast with a 500 and Stripe redelivers, instead of the handler
    // outliving Stripe's own delivery timeout.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { timeout: 10_000 });
  }
  return _stripe;
}

// Server-side plan config: the catalog (src/lib/plans.js, the single source
// of prices and copy) plus the Stripe price ids, which come from env and
// never reach the client bundle. `price` is cents, kept for existing callers.
// Stripe-side product descriptions are edited in the Stripe dashboard.
const PRICE_ID_ENV = {
  base: "STRIPE_BASE_PRICE_ID",
  unlimited: "STRIPE_UNLIMITED_PRICE_ID",
};

export const PLANS = Object.fromEntries(
  PLAN_IDS.map((id) => [
    id,
    {
      name: `Clinchd ${PLAN_CATALOG[id].name}`,
      price: PLAN_CATALOG[id].priceCents,
      priceId: process.env[PRICE_ID_ENV[id]],
      dmLimit: PLAN_CATALOG[id].conversationLimit ?? Infinity,
    },
  ])
);

/** Server plan config for a plan id from a request, or null. */
export function planForCheckout(planId) {
  return Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
}

// Checkout sessions expire 30 minutes after creation (audit M3).
export const CHECKOUT_EXPIRES_SECONDS = 30 * 60;

/**
 * Card-required subscription Checkout. Payment details are always
 * collected, including for a free trial.
 *
 * @param {string} customerId
 * @param {string} priceId - from planForCheckout, never from the client
 * @param {string} userId - Supabase user id, stored as metadata on the
 *   session AND the subscription so webhooks map back reliably
 * @param {object} [options]
 * @param {number|null} [options.trialPeriodDays] - a new trial (TRIAL_DAYS)
 *   when decideCheckoutTrial allows one
 * @param {number|null} [options.trialEnd] - unix seconds: a legacy user's
 *   REMAINING in-app trial (src/lib/checkout-trial.js). Never combined
 *   with trialPeriodDays.
 * @param {string} [options.submitMessage] - shown above Checkout's pay button
 * @param {string} [options.successPath] - app path Stripe returns to on success
 * @param {string} [options.cancelPath] - app path for "back"
 * @param {number} [options.now] - ms, for tests
 */
export async function createCheckoutSession(customerId, priceId, userId, options = {}) {
  const {
    trialPeriodDays = null,
    trialEnd = null,
    submitMessage = null,
    successPath = "/choose-plan?checkout=success",
    cancelPath = "/choose-plan",
    now = Date.now(),
  } = options;
  if (trialPeriodDays && trialEnd) {
    throw new Error("createCheckoutSession: trialPeriodDays and trialEnd are exclusive");
  }
  return getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    // Card required up front, trial or not.
    payment_method_collection: "always",
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    // No free-text promotion codes (audit L9): a code could zero out the
    // first charge of a no-trial checkout. When affiliate codes come back,
    // validate the code on our server and pass it as
    // `discounts: [{ promotion_code }]`; never re-enable this field.
    allow_promotion_codes: false,
    // Short-lived (audit M3): an abandoned session stays payable until it
    // expires, and two payable sessions are how one customer ends up with
    // two subscriptions. Stripe's minimum is 30 minutes from creation; the
    // extra minute absorbs clock skew between us and Stripe, which would
    // otherwise reject the session.
    expires_at: Math.floor(now / 1000) + CHECKOUT_EXPIRES_SECONDS + 60,
    subscription_data: {
      metadata: { userId },
      ...(trialPeriodDays ? { trial_period_days: trialPeriodDays } : {}),
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    ...(submitMessage ? { custom_text: { submit: { message: submitMessage } } } : {}),
    // Success does NOT grant access; only the webhook does. The success
    // page waits for it (src/app/(paywall)/choose-plan).
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}${successPath}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}${cancelPath}`,
    metadata: { userId },
  });
}

export async function createCustomerPortalSession(customerId) {
  return getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });
}

export async function createCustomer(email, userId) {
  return getStripe().customers.create({
    email,
    metadata: { userId },
  });
}
