import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { processDrip } from "@/lib/drip/processor";
import { pingHeartbeat } from "@/lib/heartbeat";

// Nudges without a coach-authored template are composed via generateReply at
// send time, so a full batch can take longer than the platform default.
export const maxDuration = 60;

// In-window follow-up nudge dispatcher. Runs every 15 minutes (Vercel cron;
// see vercel.json). Atomically claims up to 50 due drips via claim_due_drips
// (FOR UPDATE SKIP LOCKED, so overlapping invocations don't double-process),
// then re-verifies all 8 conditions per row inside processDrip before sending.
//
// Requires CRON_SECRET in the environment (set in Vercel). Same auth pattern
// as /api/cron/drip and /api/cron/refresh-tokens.
//
// Every run pings HEALTHCHECK_DRIP_URL (dead-man switch: /fail on error) and
// logs one summary line, so a run is visible even when nothing was due.

function isAuthorizedCron(req) {
  if (!process.env.CRON_SECRET) return false;
  const auth = Buffer.from(req.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  return auth.length === expected.length && timingSafeEqual(auth, expected);
}

export async function GET(req) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();

    // Reclaim rows stranded in 'processing' by a crashed or timed-out earlier
    // run (a kill between claim and terminal status would otherwise strand the
    // row forever — and the one-active-per-conversation index with it). A live
    // worker can't hold a row anywhere near 30 minutes (maxDuration is 60s), so
    // the cutoff is unambiguous. Safe to re-run: the processor re-verifies every
    // condition, including the 24h window, before any send.
    const staleCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: reclaimed, error: reclaimError } = await admin
      .from("dm_drip_queue")
      .update({ status: "scheduled" })
      .eq("status", "processing")
      .lt("updated_at", staleCutoff)
      .select("id");
    if (reclaimError) {
      console.error(
        "[cron/drip-process] stale-row reclaim failed:",
        reclaimError.message
      );
    }

    const { data: claimed, error } = await admin.rpc("claim_due_drips", {
      batch_size: 50,
    });

    if (error) {
      console.error("[cron/drip-process] claim_due_drips failed:", error.message);
      await pingHeartbeat(process.env.HEALTHCHECK_DRIP_URL, { fail: true });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!claimed || claimed.length === 0) {
      const summary = {
        processed: 0,
        claimed: 0,
        reclaimed: reclaimed?.length || 0,
      };
      console.log("[cron/drip-process]", JSON.stringify(summary));
      await pingHeartbeat(process.env.HEALTHCHECK_DRIP_URL);
      return NextResponse.json(summary);
    }

    // Process with a concurrency limit of 5 so we don't hammer the IG API.
    // Each row is processed independently — one failure never aborts the batch.
    const results = [];
    const queue = [...claimed];
    const workers = Array(5)
      .fill(null)
      .map(async () => {
        while (queue.length > 0) {
          const drip = queue.shift();
          if (!drip) break;
          try {
            const result = await processDrip(drip);
            results.push({ id: drip.id, ...result });
          } catch (err) {
            results.push({ id: drip.id, status: "error", error: err?.message });
          }
        }
      });
    await Promise.all(workers);

    const summary = {
      processed: results.length,
      claimed: claimed.length,
      reclaimed: reclaimed?.length || 0,
    };
    console.log("[cron/drip-process]", JSON.stringify(summary));
    await pingHeartbeat(process.env.HEALTHCHECK_DRIP_URL);
    return NextResponse.json({ ...summary, results });
  } catch (err) {
    console.error("[cron/drip-process] run failed:", err?.message);
    await pingHeartbeat(process.env.HEALTHCHECK_DRIP_URL, { fail: true });
    return NextResponse.json({ error: "drip_process_failed" }, { status: 500 });
  }
}
