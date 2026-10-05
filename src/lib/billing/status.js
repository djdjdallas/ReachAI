// Leaf module, no imports. Subscription status strings and the column list
// every access check needs. Safe to import from client components; the
// access DECISION lives server-side in src/lib/billing/access.js.

export const SUBSCRIPTION_STATUS = Object.freeze({
  // Stripe statuses, stored as Stripe reports them.
  ACTIVE: "active",
  TRIALING: "trialing",
  PAST_DUE: "past_due",
  CANCELED: "canceled",
  UNPAID: "unpaid",
  INCOMPLETE: "incomplete",
  INCOMPLETE_EXPIRED: "incomplete_expired",
  PAUSED: "paused",
  // App-only statuses. 'expired' was written by the old lazy trial flip
  // (no longer written); 'inactive' is the column default and the state of
  // a new signup before Checkout completes.
  EXPIRED: "expired",
  INACTIVE: "inactive",
});

// Select these (plus whatever else a caller needs) before calling
// hasActiveAccess. A row missing any of them is treated as no access.
export const ACCESS_COLUMNS =
  "plan, subscription_status, stripe_subscription_id, trial_ends_at, current_period_end";
