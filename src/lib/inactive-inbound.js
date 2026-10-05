// Shared by the Instagram webhook (server) and the dashboard / trial-expired
// modal (client).
//
// A lead who DMs a coach without access (trial ended, canceled) used to be
// dropped before the message was saved: the webhook returned early, so the
// coach never saw it and nobody could count it. @nucerlifts lost 481
// threads this way in two weeks while hand-replying in the Instagram app.
// The webhook now SAVES the inbound message for these accounts and does
// nothing else: no AI, classifier, voice, drip, or send.

import { accessDecision } from "@/lib/billing/access";

export const INACTIVE_REASONS = Object.freeze({
  SUBSCRIPTION_INACTIVE: "subscription_inactive",
  // A legacy no-card trial that has ended (kept as its own reason so the
  // missed-leads count can say "since your trial ended").
  TRIAL_EXPIRED: "trial_expired",
});

/**
 * Why this account must not get an AI reply, or null when it has access.
 * The decision is hasActiveAccess's (src/lib/billing/access.js); this only
 * names the skip reason. Server-side use (the Instagram webhook).
 *
 * No status flip: the old version rewrote a lapsed 'trialing' row to
 * 'expired' + ai_mode 'off'. With Stripe's own statuses stored, a Stripe
 * trial is also 'trialing', so that flip could expire a real subscription
 * whose renewal webhook hadn't landed yet. Access is computed, not stored.
 *
 * @param {object} user - users row with ACCESS_COLUMNS
 * @param {number} [now] - ms since epoch, for tests
 * @returns {{reason: string}|null}
 */
export function inactiveGate(user, now = Date.now()) {
  const decision = accessDecision(user, now);
  if (decision.hasAccess) return null;
  return {
    reason:
      decision.reason === "legacy_trial_ended"
        ? INACTIVE_REASONS.TRIAL_EXPIRED
        : INACTIVE_REASONS.SUBSCRIPTION_INACTIVE,
  };
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
