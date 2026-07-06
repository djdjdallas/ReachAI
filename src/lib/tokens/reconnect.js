import { sendEmail } from "@/lib/notifications";

/**
 * Token self-healing constants + failure classification + reconnect
 * notifications, shared by /api/cron/refresh-tokens.
 *
 * Design rule (the whole point): a reconnect is demanded ONLY on a definitive
 * auth failure. Transient errors (5xx, rate limit, network) must never flag a
 * healthy account, or paying coaches get nagged to reconnect for no reason.
 */

// Refresh Meta tokens this many days BEFORE expiry. With a daily cron that's
// ~10 attempts before the 60-day token hard-expires, so a few missed/transient
// runs never force a reconnect.
export const META_REFRESH_WINDOW_DAYS = 10;

// Meta's refresh_access_token rejects a token younger than 24h.
export const MIN_TOKEN_AGE_HOURS = 24;

// Refresh Calendly/Google access tokens expiring within this window. Their
// access tokens live 1–2h, so a daily cron effectively refreshes every connected
// account each day — which is what surfaces a revoked refresh token early.
export const OAUTH_REFRESH_WINDOW_HOURS = 24;

const PROVIDERS = {
  meta: {
    label: "Instagram",
    flag: "meta_reconnect_required",
    notifiedAt: "meta_reconnect_notified_at",
    impact: "send or reply to your Instagram DMs",
  },
  calendly: {
    label: "Calendly",
    flag: "calendly_reconnect_required",
    notifiedAt: "calendly_reconnect_notified_at",
    impact: "sync your Calendly availability",
  },
  google: {
    label: "Google Calendar",
    flag: "google_calendar_reconnect_required",
    notifiedAt: "google_calendar_reconnect_notified_at",
    impact: "sync your Google Calendar availability",
  },
};

export function providerMeta(provider) {
  return PROVIDERS[provider];
}

/**
 * Definitive Meta auth death: OAuthException or code 190. Prefers the structured
 * fields attached by refreshLongLivedToken; falls back to a message match.
 */
export function isMetaAuthError(err) {
  if (!err) return false;
  if (err.metaType === "OAuthException" || err.metaCode === 190) return true;
  return /OAuthException|\b190\b|expired|invalid.*token|revoked/i.test(
    err.message || ""
  );
}

/**
 * Definitive Calendly/Google refresh-token death: invalid_grant, or an HTTP
 * 400/401 (which Calendly's helper embeds as "(400)"/"(401)" in the message).
 */
export function isRefreshTokenDead(err) {
  return /invalid_grant|\(400\)|\(401\)|unauthorized|invalid.*(grant|token)/i.test(
    err?.message || ""
  );
}

function reconnectUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.clinchd.io";
  return `${base}/settings`;
}

/**
 * Coach-facing "please reconnect" email. Never throws (sendEmail swallows).
 * Returns true if an address was available and the send was attempted.
 *
 * @param {{email?: string|null, fullName?: string|null}} identity
 * @param {"meta"|"calendly"|"google"} provider
 */
export async function sendCoachReconnectEmail(identity, provider) {
  const meta = PROVIDERS[provider];
  if (!identity?.email || !meta) return false;

  const url = reconnectUrl();
  const greeting = identity.fullName ? ` ${identity.fullName}` : "";
  await sendEmail({
    to: identity.email,
    subject: `Action needed: reconnect ${meta.label} to keep Clinchd running`,
    html: `<p>Hi${greeting},</p>
<p>Your ${meta.label} connection to Clinchd stopped working and needs to be reconnected. Until you do, Clinchd can't ${meta.impact}.</p>
<p><a href="${url}">Reconnect ${meta.label} &rarr;</a></p>
<p>It only takes about 30 seconds. If you need a hand, just reply to this email or reach us at support@clinchd.io.</p>
<p>&mdash; Clinchd</p>`,
  });
  return true;
}

/**
 * One ops digest naming every coach flagged this run. Sent to the same address
 * as the monitor alerts. Never throws.
 *
 * @param {Array<{label: string, provider: string, reason: string}>} entries
 */
export async function sendOpsReconnectDigest(entries) {
  if (!entries?.length) return;
  const to =
    process.env.ALERT_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "dominickjerell@gmail.com";

  const rows = entries
    .map(
      (e) =>
        `<li><strong>${PROVIDERS[e.provider]?.label || e.provider}</strong> — ${e.label}<br/><small>${escapeHtml(e.reason)}</small></li>`
    )
    .join("");

  await sendEmail({
    to,
    subject: `[Clinchd Monitor] ${entries.length} account(s) need reconnect`,
    html: `<p>The token refresh cron flagged these accounts as needing a manual reconnect. A reconnect email was sent to each coach automatically.</p><ul>${rows}</ul>`,
  });
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
}
