import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/notifications";
import { DRIP_SEQUENCE } from "@/lib/drip-emails";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://clinchd.io";

export async function POST(request) {
  try {
    // Internal-only endpoint — require a shared secret from callers (the
    // Stripe webhook is the only real caller today; cron uses the same).
    const provided = request.headers.get("x-internal-secret");
    if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, email, full_name, drip_enrolled_at, drip_step")
      .eq("id", userId)
      .single();

    if (userErr || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Already enrolled — skip
    if (user.drip_enrolled_at) {
      return NextResponse.json({ skipped: true });
    }

    // Enroll
    await supabase
      .from("users")
      .update({ drip_enrolled_at: new Date().toISOString(), drip_step: 0 })
      .eq("id", userId);

    // Send step 1 immediately
    const step = DRIP_SEQUENCE[0];
    const html = step.html
      .replaceAll("{{full_name}}", user.full_name || "there")
      .replaceAll("{{app_url}}", APP_URL);

    await sendEmail({
      to: user.email,
      subject: step.subject,
      html,
    });

    // Log event + advance step
    await supabase.from("email_events").insert({
      user_id: userId,
      event_type: "drip_step_1",
      metadata: {},
    });

    await supabase
      .from("users")
      .update({ drip_step: 1 })
      .eq("id", userId);

    return NextResponse.json({ enrolled: true });
  } catch (err) {
    console.error("Drip enroll error:", err.message);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
