import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getOnboardingState } from "@/lib/onboarding";

const ALLOWED_MODES = ["active", "handoff", "off"];

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mode } = await request.json();
    if (!ALLOWED_MODES.includes(mode)) {
      return NextResponse.json(
        { error: `mode must be one of: ${ALLOWED_MODES.join(", ")}` },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("script_config, instagram_business_account_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    if (mode === "active") {
      const onboarding = getOnboardingState(profile);
      if (!onboarding.complete) {
        return NextResponse.json(
          {
            error: "Cannot activate agent: complete your Sales Script first.",
            missing: onboarding.missing,
          },
          { status: 400 }
        );
      }
    }

    const { error: updateError } = await admin
      .from("users")
      .update({ ai_mode: mode })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update ai_mode" }, { status: 500 });
    }

    return NextResponse.json({ ai_mode: mode }, { status: 200 });
  } catch (err) {
    console.error("ai-mode toggle error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
