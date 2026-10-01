// Leaf module, no imports. Shared by the Instagram webhook (server) and the
// dashboard / trial-expired modal (client).
//
// A lead who DMs a coach whose subscription doesn't serve (trial expired,
// canceled) used to be dropped before the message was saved: the webhook
// returned early, so the coach never saw it and nobody could count it.
// @nucerlifts lost 481 threads this way in two weeks while hand-replying in
// the Instagram app. The webhook now SAVES the inbound message for these
// accounts and does nothing else: no AI, classifier, voice, drip, or send.

// Statuses the reply gates serve. past_due is a grace window while Stripe
// retries the card; access ends at 'canceled'.
export const SERVING_STATUSES = ["active", "trialing", "past_due"];

export const INACTIVE_REASONS = Object.freeze({
  SUBSCRIPTION_INACTIVE: "subscription_inactive",
  // The turn that discovers a lapsed trial (and flips the row to 'expired').
  TRIAL_EXPIRED: "trial_expired",
});

/**
 * Why this account must not get an AI reply, or null when it is served.
 *
 * @param {object} user - users row (subscription_status, trial_ends_at)
 * @param {number} [now] - ms since epoch, for tests
 * @returns {{reason: string, flipToExpired: boolean}|null}
 */
export function inactiveGate(user, now = Date.now()) {
  if (!SERVING_STATUSES.includes(user?.subscription_status)) {
    return { reason: INACTIVE_REASONS.SUBSCRIPTION_INACTIVE, flipToExpired: false };
  }
  if (user.subscription_status === "trialing") {
    const endMs = user.trial_ends_at ? new Date(user.trial_ends_at).getTime() : NaN;
    if (Number.isFinite(endMs) && now > endMs) {
      return { reason: INACTIVE_REASONS.TRIAL_EXPIRED, flipToExpired: true };
    }
  }
  return null;
}

// intent_classification.reason written on every inbound the gate saves, so
// the row records why it got no classification and no reply.
export function inactiveSentinelReason(reason) {
  return `gated before classification: ${reason}`;
}

/**
 * Dashboard / modal line for an expired or canceled coach, or null when
 * there is nothing to show.
 */
export function missedLeadsText(count, subscriptionStatus) {
  if (!count || count < 1) return null;
  const since =
    subscriptionStatus === "canceled"
      ? "since your plan ended"
      : "since your trial ended";
  const who = count === 1 ? "1 lead messaged you" : `${count} leads messaged you`;
  return `${who} ${since}. Turn your AI back on to reply automatically.`;
}

/**
 * Leads who messaged while the AI couldn't reply: conversations whose last
 * inbound turn the subscription gate skipped. Counts LEADS (threads), not
 * messages, so the "N leads messaged you" copy is literally true (one lead
 * often sends several messages). Also covers threads gated before inbound
 * saving existed, which already carry these skip reasons. A served turn
 * after resubscribing clears the reason, so the count only ever describes
 * the current lapse.
 *
 * @param {object} supabase - browser client (RLS-scoped)
 * @param {string} userId
 * @returns {Promise<number>} 0 on any error, so the notice just stays hidden
 */
export async function countMissedLeads(supabase, userId) {
  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("last_skip_reason", Object.values(INACTIVE_REASONS));
  return error ? 0 : count || 0;
}
