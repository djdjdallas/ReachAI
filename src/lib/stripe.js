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
    dmLimit: 500,
  },
  unlimited: {
    name: "Clinchd Unlimited",
    price: 19700, // $197.00
    priceId: process.env.STRIPE_UNLIMITED_PRICE_ID,
    dmLimit: Infinity,
  },
};

export async function createCheckoutSession(customerId, priceId, userId) {
  return getStripe().checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
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
