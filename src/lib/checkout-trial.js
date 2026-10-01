// Leaf module, no imports: shared by the checkout route (server) and the
// billing page / trial-expired modal (client) so the button copy and what
// Stripe actually does can never disagree.
//
// The 7-day trial is granted once, at signup, by the DB trigger
// (008_trial_on_signup) as users.trial_ends_at. Checkout used to add a fresh
// trial_period_days: 7 on top (stacked ~14 days, removed 2026-08-25), and
// then passed no trial at all, so paying mid-trial charged the full price
// immediately and silently forfeited the remaining days.
//
// Now: a trialing user who checks out keeps EXACTLY their remaining in-app
// trial, never more. trial_end is trial_ends_at rounded DOWN to the second.
// Stripe requires Checkout's subscription_data.trial_end to be at least 48
// hours in the future (API reference, PostCheckoutSessions). Below 49 hours
// remaining (1h margin for a slow checkout) there is no Stripe trial: the
// user is charged today and every surface says so up front.

export const MIN_TRIAL_LEAD_MS = 49 * 60 * 60 * 1000;
// Stripe caps trials at 730 days. Only reachable for hand-edited rows.
const MAX_TRIAL_MS = 730 * 24 * 60 * 60 * 1000;

/**
 * @param {object} args
 * @param {string} args.subscriptionStatus - users.subscription_status
 * @param {string|Date|null} args.trialEndsAt - users.trial_ends_at
 * @param {number} [args.now] - ms since epoch, for tests
 * @returns {{trialEnd: number|null, chargeToday: boolean}} trialEnd is unix
 *   seconds for subscription_data.trial_end, or null to charge today
 */
export function planCheckoutTrial({ subscriptionStatus, trialEndsAt, now = Date.now() }) {
  const endMs = trialEndsAt ? new Date(trialEndsAt).getTime() : NaN;
  const remaining = endMs - now;
  if (
    subscriptionStatus !== "trialing" ||
    !Number.isFinite(endMs) ||
    remaining < MIN_TRIAL_LEAD_MS ||
    remaining > MAX_TRIAL_MS
  ) {
    return { trialEnd: null, chargeToday: true };
  }
  return { trialEnd: Math.floor(endMs / 1000), chargeToday: false };
}

/** 9700 → "$97", 9799 → "$97.99" */
export function formatPrice(cents) {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

/** e.g. "October 2" */
export function formatTrialDate(unixSeconds) {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function chargeTodayText(priceCents) {
  return `You'll be charged ${formatPrice(priceCents)} today.`;
}

export function trialContinuesText(trialEndUnix, priceCents) {
  return `Your free trial continues until ${formatTrialDate(trialEndUnix)}. You won't be charged ${formatPrice(priceCents)} until then.`;
}
