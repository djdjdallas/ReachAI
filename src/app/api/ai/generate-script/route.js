import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateScript } from "@/lib/anthropic";

export async function POST(request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { offer, targetCustomer, objections } = await request.json();

    if (!offer || !targetCustomer) {
      return NextResponse.json(
        { error: "offer and targetCustomer are required" },
        { status: 400 }
      );
    }

    // Fetch voice profile + script_config settings so generated scripts match
    // the coach's voice and persisted preferences (tone, traits, length).
    const { data: userProfile } = await getSupabaseAdmin()
      .from("users")
      .select("voice_profile, script_config")
      .eq("id", user.id)
      .single();

    const sc = userProfile?.script_config || {};
    const settings = {
      tone: sc.tone,
      traits: sc.traits,
      response_length: sc.response_length,
    };

    const script = await generateScript(
      offer,
      targetCustomer,
      objections || "",
      userProfile?.voice_profile,
      settings
    );

    return NextResponse.json({ script }, { status: 200 });
  } catch (error) {
    console.error("Generate script error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate script. Please try again." },
      { status: 500 }
    );
  }
}
