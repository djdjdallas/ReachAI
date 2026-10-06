import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runOutboundDelivery } from "@/lib/outbound-webhooks/deliver";

// A batch is at most 20 events, 5 at a time, each capped at 10s.
export const maxDuration = 60;

// Outbound lifecycle webhook delivery (docs/outbound-webhooks.md). Runs
// every minute (vercel.json): the first attempt of a new event goes out on
// the next tick, retries follow the schedule in events.js. Also logs emit
// failures the triggers recorded, and once an hour purges bodies older than
// 30 days.
export async function GET(req) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();
  const purge = new Date(now).getUTCMinutes() === 7;
  const summary = await runOutboundDelivery(getSupabaseAdmin(), { now, purge });
  if (summary.claimed || summary.emitFailures || summary.purged) {
    console.log("[cron/outbound-webhooks]", JSON.stringify(summary));
  }
  return NextResponse.json(summary);
}
