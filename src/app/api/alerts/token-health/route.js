import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { describeUsers } from "@/lib/users/identity";

/**
 * GET /api/alerts/token-health
 *
 * Token-gated (Authorization: Bearer ${ALERT_TOKEN}) read-only snapshot of
 * integration-token health per provider (meta / calendly / google), WITH user
 * identity — so a liveness monitor can name exactly which coach needs to
 * reconnect instead of surfacing a bare UUID. Fails closed if ALERT_TOKEN unset.
 *
 * This endpoint is token-gated and consumed only by ops/monitors, so it returns
 * real identity (email + IG handle) rather than masked values.
 *
 * Phase 1 derives state from expiry + refresh-token presence (best-effort).
 * Phase 2 will make it authoritative via per-provider *_token_status columns.
 */
const META_EXPIRING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request) {
  const token = process.env.ALERT_TOKEN;
  const auth = request.headers.get("authorization");
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const nowMs = Date.now();

  const [meta, cal, gcal] = await Promise.all([
    admin
      .from("users")
      .select("id, meta_token_expires_at, meta_reconnect_required")
      .not("meta_user_access_token", "is", null),
    admin
      .from("users")
      .select(
        "id, calendly_token_expires_at, calendly_refresh_token, calendly_reconnect_required"
      )
      .not("calendly_access_token", "is", null),
    admin
      .from("users")
      .select(
        "id, google_calendar_token_expires_at, google_calendar_refresh_token, google_calendar_reconnect_required"
      )
      .not("google_calendar_access_token", "is", null),
  ]);

  if (meta.error || cal.error || gcal.error) {
    return NextResponse.json(
      {
        error: "query_failed",
        detail: meta.error?.message || cal.error?.message || gcal.error?.message,
      },
      { status: 502 }
    );
  }

  const daysLeft = (ts) =>
    ts ? Math.round((new Date(ts).getTime() - nowMs) / DAY_MS) : null;

  const atRisk = [];

  // Meta: the refresh cron's persisted meta_reconnect_required flag is
  // authoritative (set only on a definitive OAuthException). Fall back to
  // expiry: already-expired = refresh is failing; within the window = expiring.
  for (const r of meta.data || []) {
    const dl = daysLeft(r.meta_token_expires_at);
    let state = "healthy";
    if (r.meta_reconnect_required || (dl !== null && dl < 0))
      state = "needs_reconnect";
    else if (dl !== null && dl <= META_EXPIRING_DAYS) state = "expiring";
    if (state !== "healthy")
      atRisk.push({
        userId: r.id,
        provider: "meta",
        state,
        expires_at: r.meta_token_expires_at,
        days_left: dl,
      });
  }

  // Calendly & Google refresh lazily on use; unrecoverable only when the refresh
  // token is revoked (cron sets *_reconnect_required) or missing entirely.
  for (const r of cal.data || []) {
    if (r.calendly_reconnect_required || !r.calendly_refresh_token)
      atRisk.push({
        userId: r.id,
        provider: "calendly",
        state: "needs_reconnect",
        expires_at: r.calendly_token_expires_at,
        days_left: daysLeft(r.calendly_token_expires_at),
      });
  }

  for (const r of gcal.data || []) {
    if (r.google_calendar_reconnect_required || !r.google_calendar_refresh_token)
      atRisk.push({
        userId: r.id,
        provider: "google",
        state: "needs_reconnect",
        expires_at: r.google_calendar_token_expires_at,
        days_left: daysLeft(r.google_calendar_token_expires_at),
      });
  }

  const idMap = await describeUsers(
    admin,
    atRisk.map((a) => a.userId)
  );

  const atRiskUsers = atRisk.map((a) => ({
    provider: a.provider,
    state: a.state,
    user: idMap[a.userId]?.label || a.userId,
    ig_handle: idMap[a.userId]?.igHandle || null,
    email: idMap[a.userId]?.email || null,
    expires_at: a.expires_at ?? null,
    days_left: a.days_left,
  }));

  const needsReconnect = atRisk.filter(
    (a) => a.state === "needs_reconnect"
  ).length;
  const expiring = atRisk.filter((a) => a.state === "expiring").length;

  return NextResponse.json({
    ok: true,
    checked_at: new Date(nowMs).toISOString(),
    meta_expiring_days: META_EXPIRING_DAYS,
    counts: {
      connected: {
        meta: (meta.data || []).length,
        calendly: (cal.data || []).length,
        google: (gcal.data || []).length,
      },
      needs_reconnect: needsReconnect,
      expiring,
    },
    at_risk_users: atRiskUsers,
    healthy: needsReconnect === 0,
  });
}
