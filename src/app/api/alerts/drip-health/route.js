import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/alerts/drip-health
 *
 * Read-only drip-queue health for external liveness monitors, so a monitor can
 * report this app's queue WITHOUT a shared Supabase MCP connector (every app has
 * its own Supabase login, so MCP can't span them). Runs server-side with this
 * project's own service role. Auth: Authorization: Bearer ${ALERT_TOKEN}.
 * Fails closed if ALERT_TOKEN is unset.
 *
 * Returns counts only — no PII.
 */
const STUCK_MINUTES = 30;

export async function GET(request) {
  const token = process.env.ALERT_TOKEN;
  const auth = request.headers.get("authorization");
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const nowMs = Date.now();
  const cutoff = new Date(nowMs - STUCK_MINUTES * 60 * 1000).toISOString();

  // Overdue: still 'scheduled' but the send time passed more than STUCK_MINUTES
  // ago — the cron should have claimed and fired (or terminally skipped) it.
  const { count: overdueScheduled, error: e1 } = await admin
    .from("dm_drip_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "scheduled")
    .lt("scheduled_at", cutoff);

  // Stuck: claimed into 'processing' but never reached a terminal status — the
  // signature of a crashed/timed-out drip-process run.
  const { count: stuckProcessing, error: e2 } = await admin
    .from("dm_drip_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "processing");

  // Oldest overdue item, to express backlog age.
  const { data: oldest } = await admin
    .from("dm_drip_queue")
    .select("scheduled_at")
    .eq("status", "scheduled")
    .lt("scheduled_at", cutoff)
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Last successful send — proxy for "drip-process is actually executing".
  const { data: lastFired } = await admin
    .from("dm_drip_queue")
    .select("fired_at")
    .eq("status", "fired")
    .order("fired_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e1 || e2) {
    return NextResponse.json(
      { error: "query_failed", detail: e1?.message || e2?.message },
      { status: 502 }
    );
  }

  const oldestAgeMinutes = oldest?.scheduled_at
    ? Math.round((nowMs - new Date(oldest.scheduled_at).getTime()) / 60000)
    : null;
  const lastFiredAgoMinutes = lastFired?.fired_at
    ? Math.round((nowMs - new Date(lastFired.fired_at).getTime()) / 60000)
    : null;

  return NextResponse.json({
    ok: true,
    checked_at: new Date(nowMs).toISOString(),
    stuck_threshold_minutes: STUCK_MINUTES,
    overdue_scheduled: overdueScheduled ?? 0,
    stuck_processing: stuckProcessing ?? 0,
    oldest_overdue_scheduled_at: oldest?.scheduled_at ?? null,
    oldest_overdue_age_minutes: oldestAgeMinutes,
    last_fired_at: lastFired?.fired_at ?? null,
    last_fired_ago_minutes: lastFiredAgoMinutes,
    healthy: (overdueScheduled ?? 0) === 0 && (stuckProcessing ?? 0) === 0,
  });
}
