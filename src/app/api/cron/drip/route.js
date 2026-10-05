import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/notifications";
import { DRIP_SEQUENCE } from "@/lib/drip-emails";
import { hasActiveAccess } from "@/lib/billing/access";
import { ACCESS_COLUMNS } from "@/lib/billing/status";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://clinchd.io";

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let autoEnrolled = 0;

  try {
    // Self-healing fallback: the Stripe webhook calls /api/drip/enroll as a
    // fire-and-forget fetch. If that request silently fails (cold start,
    // network blip), the user would never receive any drip emails. Catch
    // those by auto-enrolling any recently-active subscriber whose enrollment
    // is missing — limited to the last 14 days so we never back-enroll
    // legacy users from before this feature shipped.
    const fourteenDaysAgo = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Who gets the drip is the single access check (hasActiveAccess, audit
    // L5), not a status list: a raw 'active'/'trialing' match also caught
    // expired legacy trials and periods that ended without a webhook, and
    // missed nobody the access function would let in. Trialing users are
    // included that way, so a coach who closes the tab mid-onboarding still
    // gets the welcome drip during their trial.
    const { data: enrollCandidates } = await supabase
      .from("users")
      .select(`id, ${ACCESS_COLUMNS}`)
      .is("drip_enrolled_at", null)
      // A pending cancellation keeps status 'active' until the period ends;
      // don't start an onboarding drip for someone who is leaving.
      .is("cancel_at", null)
      .gte("created_at", fourteenDaysAgo);
    const stragglers = (enrollCandidates || []).filter((u) => hasActiveAccess(u));

    if (stragglers.length > 0) {
      const nowIso = new Date().toISOString();
      for (const u of stragglers) {
        const { error: enrollErr } = await supabase
          .from("users")
          .update({ drip_enrolled_at: nowIso, drip_step: 0 })
          .eq("id", u.id)
          .is("drip_enrolled_at", null);
        if (!enrollErr) autoEnrolled++;
      }
    }

    // Users enrolled in drip who haven't finished all steps and still have
    // access (same access check as enrollment above).
    const { data: enrolled, error: queryErr } = await supabase
      .from("users")
      .select(`id, email, full_name, drip_enrolled_at, drip_step, ${ACCESS_COLUMNS}`)
      .not("drip_enrolled_at", "is", null)
      .lt("drip_step", DRIP_SEQUENCE.length)
      // Stop the onboarding drip once a cancellation is pending (status
      // stays 'active' until the period ends). A canceled customer kept
      // getting "your AI DM setter is waiting" emails.
      .is("cancel_at", null);

    if (queryErr) {
      console.error("Drip cron query error:", queryErr);
      return NextResponse.json({ error: "Query failed" }, { status: 500 });
    }
    const users = (enrolled || []).filter((u) => hasActiveAccess(u));

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
      autoEnrolled,
      sent,
      skipped,
      errors,
    });
  } catch (err) {
    console.error("Drip cron error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
