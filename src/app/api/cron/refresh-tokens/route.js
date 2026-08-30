import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { refreshLongLivedToken } from "@/lib/instagram";
import { refreshAccessToken as refreshCalendlyToken } from "@/lib/calendly";
import { refreshGoogleToken } from "@/lib/google-calendar";
import { encryptToken, decryptToken } from "@/lib/token-utils";
import { describeUsers } from "@/lib/users/identity";
import {
  META_REFRESH_WINDOW_DAYS,
  MIN_TOKEN_AGE_HOURS,
  OAUTH_REFRESH_WINDOW_HOURS,
  classifyMetaAuthFailure,
  describeMetaAuthFailure,
  isMetaAuthError,
  isRefreshTokenDead,
  providerMeta,
  sendCoachReconnectEmail,
  sendOpsReconnectDigest,
} from "@/lib/tokens/reconnect";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * GET /api/cron/refresh-tokens
 *
 * Daily self-healing token refresh for all three integrations. Proactively
 * renews tokens BEFORE they expire so active accounts never lapse, and — only
 * on a definitive auth failure — flags the account for reconnect, emails the
 * coach a reconnect link, and alerts ops. Transient failures are left untouched
 * to retry next run. Tokens are always handled encrypted (decrypt→refresh→
 * encrypt); plaintext never touches the database.
 *
 * Secured by CRON_SECRET header.
 */
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // Accounts flagged for reconnect this run: { userId, provider, reason, cause }.
  const reconnectEntries = [];

  const meta = await refreshMeta(supabase, nowMs, reconnectEntries);
  const calendly = await refreshCalendly(supabase, nowMs, reconnectEntries);
  const google = await refreshGoogle(supabase, nowMs, reconnectEntries);

  // ── Remediation: email each affected coach + one ops digest ───────────
  let notified = 0;
  if (reconnectEntries.length > 0) {
    const idMap = await describeUsers(
      supabase,
      reconnectEntries.map((e) => e.userId)
    );
    const opsEntries = [];
    for (const entry of reconnectEntries) {
      const identity = idMap[entry.userId];
      const sent = await sendCoachReconnectEmail(identity, entry.provider, entry.cause);
      if (sent) {
        notified++;
        await supabase
          .from("users")
          .update({ [providerMeta(entry.provider).notifiedAt]: nowIso })
          .eq("id", entry.userId);
      }
      console.error(
        `[refresh-tokens] RECONNECT provider=${entry.provider} user=${entry.userId} who=${identity?.maskedLabel || "?"} emailed=${sent} reason=${entry.reason}`
      );
      opsEntries.push({
        label: identity?.label || entry.userId,
        provider: entry.provider,
        reason: entry.reason,
      });
    }
    await sendOpsReconnectDigest(opsEntries);
  }

  const totalReconnect = reconnectEntries.length;
  if (totalReconnect > 0 || meta.transient + calendly.transient + google.transient > 0) {
    console.error(
      `[refresh-tokens] summary meta=${JSON.stringify(meta)} calendly=${JSON.stringify(calendly)} google=${JSON.stringify(google)} reconnect_flagged=${totalReconnect} coaches_emailed=${notified}`
    );
  }

  return NextResponse.json({
    status: "ok",
    checked_at: nowIso,
    reconnect_flagged: totalReconnect,
    coaches_emailed: notified,
    meta,
    calendly,
    google,
  });
}

// ── Meta / Instagram: extend the 60-day long-lived token ────────────────
async function refreshMeta(supabase, nowMs, reconnectEntries) {
  const stats = { checked: 0, refreshed: 0, skipped: 0, needs_reconnect: 0, transient: 0 };
  const cutoff = new Date(nowMs + META_REFRESH_WINDOW_DAYS * DAY_MS).toISOString();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, meta_user_access_token, meta_token_expires_at, meta_token_refreshed_at")
    .eq("meta_reconnect_required", false)
    .not("meta_user_access_token", "is", null)
    .lt("meta_token_expires_at", cutoff);

  if (error) {
    stats.error = error.message;
    return stats;
  }
  stats.checked = users.length;

  for (const u of users) {
    // Meta refuses to refresh a token younger than 24h.
    if (u.meta_token_refreshed_at) {
      const ageHours = (nowMs - new Date(u.meta_token_refreshed_at).getTime()) / HOUR_MS;
      if (ageHours < MIN_TOKEN_AGE_HOURS) {
        stats.skipped++;
        continue;
      }
    }

    try {
      const { accessToken, expiresIn } = await refreshLongLivedToken(
        decryptToken(u.meta_user_access_token)
      );
      const encrypted = encryptToken(accessToken);
      await supabase
        .from("users")
        .update({
          meta_user_access_token: encrypted,
          meta_page_access_token: encrypted,
          meta_token_expires_at: new Date(nowMs + expiresIn * 1000).toISOString(),
          meta_token_refreshed_at: new Date(nowMs).toISOString(),
          meta_reconnect_required: false,
        })
        .eq("id", u.id);
      stats.refreshed++;
    } catch (err) {
      // Never null the token on failure. Only a definitive auth error demands a
      // reconnect; anything else is transient and retried on the next run.
      if (isMetaAuthError(err)) {
        await supabase
          .from("users")
          .update({ meta_reconnect_required: true })
          .eq("id", u.id);
        reconnectEntries.push({
          userId: u.id,
          provider: "meta",
          reason: describeMetaAuthFailure(err),
          cause: classifyMetaAuthFailure(err),
        });
        stats.needs_reconnect++;
      } else {
        stats.transient++;
      }
    }
  }
  return stats;
}

// ── Calendly: mint a fresh access token from the (rotating) refresh token ─
async function refreshCalendly(supabase, nowMs, reconnectEntries) {
  const stats = { checked: 0, refreshed: 0, needs_reconnect: 0, transient: 0 };
  const cutoff = new Date(nowMs + OAUTH_REFRESH_WINDOW_HOURS * HOUR_MS).toISOString();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, calendly_refresh_token, calendly_token_expires_at")
    .eq("calendly_reconnect_required", false)
    .not("calendly_refresh_token", "is", null)
    .lt("calendly_token_expires_at", cutoff);

  if (error) {
    stats.error = error.message;
    return stats;
  }
  stats.checked = users.length;

  for (const u of users) {
    try {
      const tokens = await refreshCalendlyToken(decryptToken(u.calendly_refresh_token));
      const update = {
        calendly_access_token: encryptToken(tokens.access_token),
        calendly_token_expires_at: new Date(
          nowMs + (tokens.expires_in || 0) * 1000
        ).toISOString(),
        calendly_reconnect_required: false,
      };
      // Calendly rotates refresh tokens (single-use). Only overwrite when a new
      // one is returned — encryptToken(null) would brick future refreshes.
      if (tokens.refresh_token) {
        update.calendly_refresh_token = encryptToken(tokens.refresh_token);
      }
      await supabase.from("users").update(update).eq("id", u.id);
      stats.refreshed++;
    } catch (err) {
      if (isRefreshTokenDead(err)) {
        await supabase
          .from("users")
          .update({ calendly_reconnect_required: true })
          .eq("id", u.id);
        reconnectEntries.push({ userId: u.id, provider: "calendly", reason: err.message });
        stats.needs_reconnect++;
      } else {
        stats.transient++;
      }
    }
  }
  return stats;
}

// ── Google Calendar: mint a fresh access token from the refresh token ─────
async function refreshGoogle(supabase, nowMs, reconnectEntries) {
  const stats = { checked: 0, refreshed: 0, needs_reconnect: 0, transient: 0 };
  const cutoff = new Date(nowMs + OAUTH_REFRESH_WINDOW_HOURS * HOUR_MS).toISOString();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, google_calendar_refresh_token, google_calendar_token_expires_at")
    .eq("google_calendar_reconnect_required", false)
    .not("google_calendar_refresh_token", "is", null)
    .lt("google_calendar_token_expires_at", cutoff);

  if (error) {
    stats.error = error.message;
    return stats;
  }
  stats.checked = users.length;

  for (const u of users) {
    try {
      const { access_token, expiry_date } = await refreshGoogleToken(
        decryptToken(u.google_calendar_refresh_token)
      );
      await supabase
        .from("users")
        .update({
          google_calendar_access_token: encryptToken(access_token),
          google_calendar_token_expires_at: new Date(
            expiry_date || nowMs + HOUR_MS
          ).toISOString(),
          google_calendar_reconnect_required: false,
        })
        .eq("id", u.id);
      stats.refreshed++;
    } catch (err) {
      if (isRefreshTokenDead(err)) {
        await supabase
          .from("users")
          .update({ google_calendar_reconnect_required: true })
          .eq("id", u.id);
        reconnectEntries.push({ userId: u.id, provider: "google", reason: err.message });
        stats.needs_reconnect++;
      } else {
        stats.transient++;
      }
    }
  }
  return stats;
}
