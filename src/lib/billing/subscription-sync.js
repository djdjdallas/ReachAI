// Leaf logic for the Stripe webhook: which users columns a Stripe
// subscription maps to. Pure; the webhook supplies the LIVE subscription
// (retrieved from Stripe, never the event payload, which can be stale on a
// retried or out-of-order delivery) and the price-to-plan resolver.
//
// Statuses are stored exactly as Stripe reports them ('trialing' stays
// 'trialing', 'unpaid' stays 'unpaid'). Access is computed from them by
// hasActiveAccess (src/lib/billing/access.js); nothing here decides access.

const iso = (unix) => (typeof unix === "number" ? new Date(unix * 1000).toISOString() : null);

/**
 * @param {object} live - Stripe subscription
 * @param {(priceId: string) => string|null} planFromPriceId
 * @returns {object} users columns to write
 */
export function subscriptionFields(live, planFromPriceId) {
  const item = live?.items?.data?.[0];
  const fields = {
    subscription_status: live.status,
    stripe_subscription_id: live.id,
    // Since API 2025-03-31 the period lives on the subscription item.
    current_period_end: iso(item?.current_period_end ?? live.current_period_end),
  };
  const plan = item?.price?.id ? planFromPriceId(item.price.id) : null;
  if (plan) fields.plan = plan;
  // trial_ends_at mirrors Stripe's trial end when there is one. Never
  // cleared here: for a Stripe-backed row, access reads status and
  // current_period_end, not trial_ends_at.
  if (typeof live.trial_end === "number") fields.trial_ends_at = iso(live.trial_end);
  return fields;
}

// Statuses that mean the subscription is over. Used to keep a stale event
// from reviving a row that customer.subscription.deleted already closed.
export const ENDED_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid"]);

// A subscription the AI should be serving (for restoring ai_mode 'off'
// when a coach comes back). Access itself is hasActiveAccess's call.
export const SERVING_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);
