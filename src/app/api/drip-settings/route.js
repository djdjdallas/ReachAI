import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseDripSequences } from "@/lib/plan";
import { enforceAiRateLimit } from "@/lib/rate-limit";

const MIN_DELAY_HOURS = 6;
const MAX_DELAY_HOURS = 22;

async function authedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, plan, subscription_status, drip_enabled, drip_delay_hours")
    .eq("id", user.id)
    .maybeSingle();

  return { user, profile };
}

export async function GET() {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  return NextResponse.json({
    drip_enabled: profile?.drip_enabled === true,
    drip_delay_hours: profile?.drip_delay_hours ?? 18,
  });
}

export async function PATCH(request) {
  const { user, profile } = await authedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canUseDripSequences(profile)) {
    return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const limited = await enforceAiRateLimit(admin, user.id, "drip-settings", 30);
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const update = {};

  if (body.drip_enabled !== undefined) {
    if (typeof body.drip_enabled !== "boolean") {
      return NextResponse.json({ error: "invalid_drip_enabled" }, { status: 400 });
    }
    update.drip_enabled = body.drip_enabled;
  }

  if (body.drip_delay_hours !== undefined) {
    const hours = Number(body.drip_delay_hours);
    if (
      !Number.isInteger(hours) ||
      hours < MIN_DELAY_HOURS ||
      hours > MAX_DELAY_HOURS
    ) {
      return NextResponse.json({ error: "invalid_drip_delay_hours" }, { status: 400 });
    }
    update.drip_delay_hours = hours;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  // Writes go through the service role so a stray RLS rule never blocks the
  // coach's own toggle.
  const { data, error } = await admin
    .from("users")
    .update(update)
    .eq("id", user.id)
    .select("drip_enabled, drip_delay_hours")
    .single();

  if (error) {
    console.error("[drip-settings:PATCH] error:", error.message);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }

  // If the coach just turned drip OFF, cancel any scheduled nudges so nothing
  // fires after they flip the master switch.
  if (update.drip_enabled === false) {
    await admin
      .from("dm_drip_queue")
      .update({
        status: "canceled",
        skip_reason: "user_drip_disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "scheduled");
  }

  return NextResponse.json({
    drip_enabled: data.drip_enabled,
    drip_delay_hours: data.drip_delay_hours,
  });
}
