// Weekly "N people messaged you this week. Clinchd didn't reply." email.
//
// The drip emails run on a timer and only reach accounts with access, so a
// coach whose AI was silently holding every lead never heard about it from
// us: one coach had leads arriving daily, held as greeting_not_configured
// and then trial_expired, and only the dashboard banners said so.
//
// This email is driven by account STATE. The blocker comes from the users
// row (access, onboarding, ai_mode, opening line), never from old thread
// reasons, so an account that has since been fixed gets nothing. The count
// is threads whose lead wrote in the last 7 days and whose last turn was
// held by an account-level gate.
//
// Not emailed:
// - managed accounts (billing_managed): the operator gets its own alerts
// - a coach who finished setup and chose handoff: that's deliberate
// - reconnect_required: the token cron already emails the reconnect

import { inactiveGate, INACTIVE_REASONS } from "@/lib/inactive-inbound";
import { ACCESS_COLUMNS } from "@/lib/billing/status";

export const DIGEST_EVENT_TYPE = "missed_leads_digest";
// Daily cron, weekly email: 6.5 days so a run a few minutes early next week
// doesn't push the send to the week after.
export const DIGEST_INTERVAL_MS = 6.5 * 24 * 60 * 60 * 1000;
export const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
// A coach who never acts stops hearing from us after a month of these.
export const DIGEST_MAX_SENDS = 4;
export const DIGEST_CAP_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

// Account-level skip reasons (src/app/api/webhooks/instagram/route.js SKIP
// plus INACTIVE_REASONS). Thread-level ones (ai_paused, human_takeover,
// do_not_send, ...) are the coach's or the classifier's call, not a broken
// account.
export const HELD_REASONS = Object.freeze([
  ...Object.values(INACTIVE_REASONS),
  "ai_inactive",
  "greeting_not_configured",
]);

export const BLOCKERS = Object.freeze({
  TRIAL_EXPIRED: "trial_expired",
  SUBSCRIPTION_INACTIVE: "subscription_inactive",
  SETUP_INCOMPLETE: "setup_incomplete",
  NO_OPENING_LINE: "no_opening_line",
});

export const DIGEST_USER_COLUMNS = `id, email, full_name, ai_mode, script_config, onboarding_completed, ${ACCESS_COLUMNS}`;

/**
 * Why this account's AI can't reply to anyone right now, or null when
 * nothing on the account is stopping it (or the stop is deliberate).
 * Same order as the webhook's gates: access first, then mode, then greeting.
 *
 * @param {object} user - users row with DIGEST_USER_COLUMNS
 * @param {number} [now] - ms since epoch, for tests
 * @returns {string|null} a BLOCKERS value
 */
export function accountBlocker(user, now = Date.now()) {
  if (!user || user.billing_managed === true) return null;
  const inactive = inactiveGate(user, now);
  if (inactive) {
    return inactive.reason === INACTIVE_REASONS.TRIAL_EXPIRED
      ? BLOCKERS.TRIAL_EXPIRED
      : BLOCKERS.SUBSCRIPTION_INACTIVE;
  }
  const hasGreeting = !!user.script_config?.greeting?.toString().trim();
  if (!user.onboarding_completed && (user.ai_mode !== "active" || !hasGreeting)) {
    return BLOCKERS.SETUP_INCOMPLETE;
  }
  if (user.ai_mode === "active" && !hasGreeting) return BLOCKERS.NO_OPENING_LINE;
  return null;
}

/**
 * Throttle: at most one digest per DIGEST_INTERVAL_MS and DIGEST_MAX_SENDS
 * per DIGEST_CAP_WINDOW_MS.
 *
 * @param {string[]} sentAts - sent_at of this user's past digests within the cap window
 * @param {number} [now]
 */
export function digestDue(sentAts, now = Date.now()) {
  const times = (sentAts || []).map((t) => Date.parse(t)).filter((t) => !Number.isNaN(t));
  if (times.filter((t) => now - t < DIGEST_CAP_WINDOW_MS).length >= DIGEST_MAX_SENDS) return false;
  return !times.some((t) => now - t < DIGEST_INTERVAL_MS);
}

const BLOCKER_COPY = {
  [BLOCKERS.TRIAL_EXPIRED]: {
    why: "Your free trial ended, so the AI stopped answering.",
    fix: "Their messages are saved. Pick a plan and the AI starts replying again:",
    path: "/choose-plan",
  },
  [BLOCKERS.SUBSCRIPTION_INACTIVE]: {
    why: "Your Clinchd plan isn't active, so the AI stopped answering.",
    fix: "Their messages are saved. Pick a plan and the AI starts replying again:",
    path: "/choose-plan",
  },
  [BLOCKERS.SETUP_INCOMPLETE]: {
    why: "Your setup isn't finished, so the AI isn't switched on yet and holds every message.",
    fix: "Finishing takes a few minutes:",
    path: "/onboarding",
  },
  [BLOCKERS.NO_OPENING_LINE]: {
    why: "Your AI doesn't have an opening line saved, so it holds every message instead of replying.",
    fix: "Add one in the Script Builder:",
    path: "/script-builder",
  },
};

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
}

/**
 * @param {{user: object, count: number, blocker: string, appUrl: string}} args
 * @returns {{subject: string, html: string}|null}
 */
export function buildMissedLeadsEmail({ user, count, blocker, appUrl }) {
  const copy = BLOCKER_COPY[blocker];
  if (!copy || !count || count < 1) return null;
  const who = count === 1 ? "1 person" : `${count} people`;
  const firstName = String(user?.full_name || "").trim().split(/\s+/)[0] || "there";

  const body = [
    `Hi ${firstName},`,
    "",
    `${who} sent you an Instagram DM this week and Clinchd didn't reply to ${count === 1 ? "them" : "any of them"}. ${copy.why}`,
    "",
    copy.fix,
    `${appUrl}${copy.path}`,
    "",
    "If you'd rather answer them yourself, they're all in your Instagram inbox.",
    "",
    "If something isn't working, reply to this email and I'll help.",
    "",
    "Dom",
    "Clinchd",
  ].join("\n");

  return {
    subject: `${who} messaged you this week. Clinchd didn't reply.`,
    html: `<pre style="font-family:inherit;white-space:pre-wrap;margin:0;">${escapeHtml(body)}</pre>`,
  };
}

/**
 * One pass over every account that could be holding leads. Never throws
 * per account: a failure on one is counted and the run moves on.
 *
 * @param {object} admin - service-role Supabase client
 * @param {{send: Function, appUrl: string, now?: number}} opts
 * @returns {Promise<{candidates: number, sent: number, skipped: number, errors: number}>}
 */
export async function runMissedLeadsDigest(admin, { send, appUrl, now = Date.now() }) {
  const stats = { candidates: 0, sent: 0, skipped: 0, errors: 0 };

  // No Instagram account means no inbound DMs, so nothing to count.
  const { data: users, error } = await admin
    .from("users")
    .select(DIGEST_USER_COLUMNS)
    .not("instagram_business_account_id", "is", null)
    .eq("billing_managed", false);
  if (error) throw new Error(`users query failed: ${error.code || error.message}`);

  const since = new Date(now - DIGEST_WINDOW_MS).toISOString();
  const capSince = new Date(now - DIGEST_CAP_WINDOW_MS).toISOString();

  for (const user of users || []) {
    const blocker = accountBlocker(user, now);
    if (!blocker || !user.email) continue;
    stats.candidates++;
    try {
      const { data: past, error: pastErr } = await admin
        .from("email_events")
        .select("sent_at")
        .eq("user_id", user.id)
        .eq("event_type", DIGEST_EVENT_TYPE)
        .gte("sent_at", capSince);
      // Fail closed: an unreadable throttle could mean a second email today.
      if (pastErr) throw new Error(`throttle read failed: ${pastErr.code}`);
      if (!digestDue((past || []).map((r) => r.sent_at), now)) {
        stats.skipped++;
        continue;
      }

      const { count, error: countErr } = await admin
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("last_skip_reason", HELD_REASONS)
        .gte("last_message_at", since);
      if (countErr) throw new Error(`count failed: ${countErr.code}`);

      const email = buildMissedLeadsEmail({ user, count, blocker, appUrl });
      if (!email) {
        stats.skipped++;
        continue;
      }

      const result = await send({ to: user.email, ...email });
      if (!result?.success) {
        stats.errors++;
        continue;
      }
      // The notification feed lists only hot_lead_alert / booking_alert, so
      // this row is the throttle and an audit trail, not an in-app item.
      const { error: logErr } = await admin.from("email_events").insert({
        user_id: user.id,
        event_type: DIGEST_EVENT_TYPE,
        metadata: { count, blocker, messageId: result.messageId || null },
        sent_at: new Date(now).toISOString(),
      });
      if (logErr) console.error("[missed-leads] event insert failed:", logErr.code);
      stats.sent++;
    } catch (err) {
      console.error(`[missed-leads] user=${user.id} failed:`, err?.message);
      stats.errors++;
    }
  }

  return stats;
}
