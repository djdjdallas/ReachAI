import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateVoiceChatReply, analyzeVoice } from "@/lib/anthropic";
import { enforceAiRateLimit } from "@/lib/rate-limit";

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

    const rl = await enforceAiRateLimit(
      getSupabaseAdmin(),
      user.id,
      "voice_chat",
      30
    );
    if (rl) return rl;

    const { messages, finalize } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    if (finalize) {
      // Extract the coach's messages from the conversation to analyze their voice
      const coachMessages = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .filter((c) => c && c.trim().length > 0);

      if (coachMessages.length < 3) {
        return NextResponse.json(
          { error: "Need at least 3 responses to analyze your voice." },
          { status: 400 }
        );
      }

      const samples = coachMessages.slice(0, 20);

      // Fetch existing profile for rollback
      const { data: existingUser } = await getSupabaseAdmin()
        .from("users")
        .select("voice_profile")
        .eq("id", user.id)
        .single();

      const result = await analyzeVoice(samples);

      const suggestedLength = ["short", "medium", "long"].includes(result.suggested_response_length)
        ? result.suggested_response_length
        : null;

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
        sample_count: samples.length,
        previous_profile: previousProfile,
        status: "ready",
        updated_at: new Date().toISOString(),
      };

      await getSupabaseAdmin()
        .from("users")
        .update({ voice_profile: voiceProfile })
        .eq("id", user.id);

      return NextResponse.json({ voice_profile: voiceProfile }, { status: 200 });
    }

    // Normal chat flow — generate next interviewer question
    const reply = await generateVoiceChatReply(messages);

    return NextResponse.json({ reply }, { status: 200 });
  } catch (error) {
    console.error("Voice chat error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate response. Please try again." },
      { status: 500 }
    );
  }
}
