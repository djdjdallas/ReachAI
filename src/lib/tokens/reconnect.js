import { sendEmail } from "@/lib/notifications";
import { describeUsers } from "@/lib/users/identity";

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
 *
 * CRON ONLY. On the refresh_access_token endpoint any OAuthException really is
 * a dead token, so the broad match is correct there. The webhook's runtime
 * flag path must use isMetaTokenRevoked instead — see its comment for why.
 */
export function isMetaAuthError(err) {
  if (!err) return false;
  if (err.metaType === "OAuthException" || err.metaCode === 190) return true;
  return /OAuthException|\b190\b|expired|invalid.*token|revoked/i.test(
    err.message || ""
  );
}

// OAuth 190 subcodes that mean the token itself is dead.
const META_DEAD_TOKEN_SUBCODES = new Set([458, 460, 463, 467]);

// Message fallback for a code-190 error that arrives without a usable subcode
// (Meta returned subcode 0 with "session has been invalidated" on 2026-08-27).
const META_DEAD_TOKEN_MESSAGE =
  /session has been invalidated|changed their password|session is invalid|not authorized application|has not authorized|expired|invalid.*token|revoked/i;

/**
 * STRICT predicate for the RUNTIME flag path (webhook profile fetch, echo
 * profile fetch, send failure). Returns true only for a genuinely dead token:
 *
 *   code === 190 AND (
 *     error_subcode in {458, 460, 463, 467}
 *     OR (error_subcode absent/0 AND the message reads as a dead session)
 *   )
 *
 * Deliberately NOT the same rule as isMetaAuthError. Meta stamps
 * type "OAuthException" on many messaging failures that are not token death —
 * 551 (recipient unavailable / lead blocked the coach), 10 (outside the 24h
 * window), 4/17/32/613 (rate limits), 100, 200. Because meta_reconnect_required
 * stops every AI reply for the account until the coach reconnects, tripping on
 * any of those would silence a healthy paying account on a single bad send.
 */
export function isMetaTokenRevoked(err) {
  if (!err || typeof err !== "object") return false;
  const code = Number(err.metaCode ?? err.code);
  if (code !== 190) return false;
  const rawSub = err.metaSubcode ?? err.error_subcode;
  const sub = Number(rawSub);
  if (rawSub !== undefined && rawSub !== null && sub !== 0) {
    return META_DEAD_TOKEN_SUBCODES.has(sub);
  }
  return META_DEAD_TOKEN_MESSAGE.test(err.message || "");
}

/**
 * Why a Meta token died. Expiry and invalidation are different failures and
 * the coach-facing copy + ops digest name them separately. Prefers the
 * OAuth 190 error_subcode; Meta frequently returns subcode 0 with only a
 * descriptive message (observed 2026-08-27), so the message is the fallback.
 *
 *   app_removed         458  coach removed the app's authorization
 *   session_invalidated 460/467  password change / Meta security reset
 *   expired             463  the 60-day token lapsed
 *   unknown             anything else that still reads as an auth failure
 */
export function classifyMetaAuthFailure(err) {
  const sub = Number(err?.metaSubcode);
  if (sub === 458) return "app_removed";
  if (sub === 460 || sub === 467) return "session_invalidated";
  if (sub === 463) return "expired";
  const msg = err?.message || "";
  if (/not authorized application|has not authorized/i.test(msg)) return "app_removed";
  if (/session has been invalidated|changed their password|session is invalid/i.test(msg))
    return "session_invalidated";
  if (/expired/i.test(msg)) return "expired";
  return "unknown";
}

/**
 * One-line, log-safe description of a Meta auth failure for the RECONNECT
 * log line and the ops digest: cause + code/subcode + Meta's message.
 */
export function describeMetaAuthFailure(err) {
  const cause = classifyMetaAuthFailure(err);
  const code = err?.metaCode ?? "?";
  const sub = err?.metaSubcode ?? "?";
  return `${cause} (code=${code} subcode=${sub}) ${err?.message || ""}`.trim();
}

const META_CAUSE_COPY = {
  app_removed:
    "Instagram reports that Clinchd's access to your account was removed.",
  session_invalidated:
    "Instagram signed Clinchd out of your account — this usually happens after a password change or an Instagram security check.",
  expired:
    "Your Instagram connection to Clinchd reached the end of its 60-day session and could not be renewed.",
  unknown: "Your Instagram connection to Clinchd stopped working.",
};

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
export async function sendCoachReconnectEmail(identity, provider, cause = "unknown") {
  const meta = PROVIDERS[provider];
  if (!identity?.email || !meta) return false;

  const url = reconnectUrl();
  const greeting = identity.fullName ? ` ${identity.fullName}` : "";
  const lead =
    provider === "meta"
      ? META_CAUSE_COPY[cause] || META_CAUSE_COPY.unknown
      : `Your ${meta.label} connection to Clinchd stopped working.`;
  await sendEmail({
    to: identity.email,
    subject: `Action needed: reconnect ${meta.label} to keep Clinchd running`,
    html: `<p>Hi${greeting},</p>
<p>${lead} It needs to be reconnected — until you do, Clinchd can't ${meta.impact}.</p>
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

/**
 * Runtime counterpart of the cron's reconnect branch. Called from the webhook
 * when a live Graph call (profile fetch, send) is rejected with a dead token —
 * the failure class the expiry-window cron cannot see (a token invalidated by
 * a password change is rejected weeks before its scheduled expiry).
 *
 * Idempotent: the flag is set with a conditional update, so only the FIRST
 * failure transitions the row and emails the coach; every later inbound DM
 * on the same dead token is a no-op here. Never throws.
 *
 * @returns {Promise<boolean>} true if this call flipped the flag.
 */
export async function flagMetaReconnect(supabase, userId, err, source = "webhook") {
  if (!supabase || !userId) return false;
  try {
    const nowIso = new Date().toISOString();
    const { data: flipped, error } = await supabase
      .from("users")
      .update({ meta_reconnect_required: true })
      .eq("id", userId)
      .eq("meta_reconnect_required", false)
      .select("id");
    if (error) {
      console.error(`[reconnect] flag update failed user=${userId}: ${error.code}`);
      return false;
    }
    if (!flipped?.length) return false;

    const reason = describeMetaAuthFailure(err);
    const idMap = await describeUsers(supabase, [userId]);
    const identity = idMap[userId];
    const cause = classifyMetaAuthFailure(err);
    const sent = await sendCoachReconnectEmail(identity, "meta", cause);
    if (sent) {
      await supabase
        .from("users")
        .update({ [PROVIDERS.meta.notifiedAt]: nowIso })
        .eq("id", userId);
    }
    console.error(
      `[${source}] RECONNECT provider=meta user=${userId} who=${identity?.maskedLabel || "?"} emailed=${sent} reason=${reason}`
    );
    await sendOpsReconnectDigest([
      { label: identity?.label || userId, provider: "meta", reason: `${source}: ${reason}` },
    ]);
    return true;
  } catch (e) {
    console.error(`[reconnect] flagMetaReconnect threw user=${userId}: ${e?.message}`);
    return false;
  }
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
