import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateVoiceChatReply, analyzeVoice } from "@/lib/anthropic";

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

      if (coachMessages.length < 2) {
        return NextResponse.json(
          { error: "Need at least a few responses to analyze your voice." },
          { status: 400 }
        );
      }

      // Merge with existing sample messages if there's an existing voice profile
      const { data: userProfile } = await getSupabaseAdmin()
        .from("users")
        .select("voice_profile")
        .eq("id", user.id)
        .single();

      const existingSamples = userProfile?.voice_profile?.sample_messages || [];
      const allSamples = [...existingSamples, ...coachMessages].slice(0, 20);

      const result = await analyzeVoice(allSamples);

      const voiceProfile = {
        sample_messages: allSamples,
        voice_summary: result.voice_summary,
        voice_traits: result.voice_traits,
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
