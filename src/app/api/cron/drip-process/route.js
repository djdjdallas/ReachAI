import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { processDrip } from "@/lib/drip/processor";

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

  const admin = getSupabaseAdmin();
  const { data: claimed, error } = await admin.rpc("claim_due_drips", {
    batch_size: 50,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ processed: 0, claimed: 0 });
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

  return NextResponse.json({
    processed: results.length,
    claimed: claimed.length,
    results,
  });
}
