import Stripe from "stripe";

let _stripe;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

export const PLANS = {
  base: {
    name: "Clinchd Base",
    price: 9700, // $97.00
    priceId: process.env.STRIPE_BASE_PRICE_ID,
    dmLimit: 1500,
    // Stripe-side product description: "1,500 qualified conversations per month."
    // Update in Stripe dashboard manually — not pushed from this file.
  },
  unlimited: {
    name: "Clinchd Unlimited",
    price: 19700, // $197.00
    priceId: process.env.STRIPE_UNLIMITED_PRICE_ID,
    dmLimit: Infinity,
  },
};

/**
 * @param {string} customerId
 * @param {string} priceId
 * @param {string} userId
 * @param {object} [options]
 * @param {number|null} [options.trialEnd] - unix seconds; the user's
 *   REMAINING in-app trial from planCheckoutTrial (src/lib/checkout-trial.js).
 *   Null charges today.
 * @param {string} [options.submitMessage] - shown above Checkout's pay button
 *   (custom_text.submit), e.g. "You'll be charged $197 today."
 */
export async function createCheckoutSession(customerId, priceId, userId, options = {}) {
  const { trialEnd = null, submitMessage = null } = options;
  return getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    // Affiliate attribution: promoters get a per-promoter promotion code;
    // payouts are read off the code's customers in the Stripe dashboard.
    allow_promotion_codes: true,
    // Never trial_period_days: the 7-day trial is granted once at signup by
    // the DB trigger (008_trial_on_signup). A fresh trial here stacked ~14
    // free days. trial_end carries only what is LEFT of that signup trial
    // (never more), so paying mid-trial no longer forfeits the remaining
    // days. See src/lib/checkout-trial.js.
    subscription_data: {
      metadata: { userId },
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    },
    ...(submitMessage ? { custom_text: { submit: { message: submitMessage } } } : {}),
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
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
