import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications";
import { DRIP_SEQUENCE } from "@/lib/drip-emails";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://clinchd.io";

export async function GET(request) {
  // Verify cron secret (same pattern as /api/cron/refresh-tokens)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // Find users enrolled in drip who haven't finished all steps
    const { data: users, error: queryErr } = await supabase
      .from("users")
      .select("id, email, full_name, drip_enrolled_at, drip_step")
      .not("drip_enrolled_at", "is", null)
      .lt("drip_step", DRIP_SEQUENCE.length)
      .eq("subscription_status", "active");

    if (queryErr) {
      console.error("Drip cron query error:", queryErr);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }

    const now = Date.now();

    for (const user of users || []) {
      const nextStepIndex = user.drip_step; // 0-based index into DRIP_SEQUENCE
      const step = DRIP_SEQUENCE[nextStepIndex];
      if (!step) {
        skipped++;
        continue;
      }

      // Check if enough time has passed since enrollment
      const enrolledAt = new Date(user.drip_enrolled_at).getTime();
      const delayMs = step.delayDays * 24 * 60 * 60 * 1000;
      if (now < enrolledAt + delayMs) {
        skipped++;
        continue;
      }

      // Dedup check — has this step already been sent?
      const eventType = `drip_step_${step.step}`;
      const { data: existing } = await supabase
        .from("email_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_type", eventType)
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Already sent — just advance the step counter
        await supabase
          .from("users")
          .update({ drip_step: step.step })
          .eq("id", user.id);
        skipped++;
        continue;
      }

      // Send the email
      const html = step.html
        .replaceAll("{{full_name}}", user.full_name || "there")
        .replaceAll("{{app_url}}", APP_URL);

      const result = await sendEmail({
        to: user.email,
        subject: step.subject,
        html,
      });

      if (result.success) {
        await supabase.from("email_events").insert({
          user_id: user.id,
          event_type: eventType,
          metadata: { messageId: result.messageId },
        });
        await supabase
          .from("users")
          .update({ drip_step: step.step })
          .eq("id", user.id);
        sent++;
      } else {
        errors++;
      }
    }

    return NextResponse.json({
      status: "ok",
      processed: (users || []).length,
      sent,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("Drip cron error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
