import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { analyzeVoice } from "@/lib/anthropic";

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

    const { sample_messages } = await request.json();

    if (
      !sample_messages ||
      !Array.isArray(sample_messages) ||
      sample_messages.length < 3
    ) {
      return NextResponse.json(
        { error: "Please provide at least 3 sample messages." },
        { status: 400 }
      );
    }

    // Filter out empty strings and cap at 20 samples
    const cleaned = sample_messages
      .map((m) => (typeof m === "string" ? m.trim() : ""))
      .filter((m) => m.length > 0)
      .slice(0, 20);

    if (cleaned.length < 3) {
      return NextResponse.json(
        { error: "Please provide at least 3 non-empty sample messages." },
        { status: 400 }
      );
    }

    // Fetch existing profile so we can store it for rollback
    const { data: existingUser } = await getSupabaseAdmin()
      .from("users")
      .select("voice_profile")
      .eq("id", user.id)
      .single();

    const result = await analyzeVoice(cleaned);

    const suggestedLength = ["short", "medium", "long"].includes(result.suggested_response_length)
      ? result.suggested_response_length
      : null;

    // Snapshot the current profile (without its own previous_profile to avoid nesting)
    const existing = existingUser?.voice_profile;
    let previousProfile = null;
    if (existing?.status === "ready") {
      const { previous_profile: _, ...snapshot } = existing;
      previousProfile = snapshot;
    }

    const voiceProfile = {
      voice_summary: result.voice_summary,
      voice_traits: result.voice_traits,
      preview_replies: result.preview_replies || [],
      suggested_response_length: suggestedLength,
      sample_count: cleaned.length,
      previous_profile: previousProfile,
      status: "ready",
      updated_at: new Date().toISOString(),
    };

    await getSupabaseAdmin()
      .from("users")
      .update({ voice_profile: voiceProfile })
      .eq("id", user.id);

    return NextResponse.json({ voice_profile: voiceProfile }, { status: 200 });
  } catch (error) {
    console.error("Analyze voice error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze voice. Please try again." },
      { status: 500 }
    );
  }
}
