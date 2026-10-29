import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/notifications";
import { runMissedLeadsDigest } from "@/lib/missed-leads-email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://clinchd.io";

// Daily (vercel.json). Each account gets at most one email a week; the
// throttle and blocker rules live in src/lib/missed-leads-email.js.
export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runMissedLeadsDigest(getSupabaseAdmin(), {
      send: sendEmail,
      appUrl: APP_URL,
    });
    console.log("[missed-leads] run", JSON.stringify(stats));
    return NextResponse.json({ status: "ok", ...stats });
  } catch (err) {
    console.error("[missed-leads] cron error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
