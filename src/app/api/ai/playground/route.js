import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";

/**
 * POST /api/ai/playground
 *
 * Simulates a DM conversation using the user's real script_config.
 * This gives users an accurate preview of how their AI agent will
 * respond before they activate it on their live Instagram account.
 *
 * Uses the same system prompt as the webhook (via buildSystemPrompt),
 * with isPlayground: true so the model knows it's in a test environment.
 *
 * Request body:
 * {
 *   messages: Array<{ role: "user" | "assistant", content: string }>
 * }
 *
 * Response:
 * {
 *   reply: string,
 *   hasBookingLink: boolean
 * }
 */
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

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const { data: userProfile, error: profileError } = await getSupabaseAdmin()
      .from("users")
      .select("script_config, calendly_url, voice_profile")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const scriptConfig = userProfile.script_config || {};
    const calendlyUrl = userProfile.calendly_url || "";

    if (!scriptConfig.greeting && !scriptConfig.offer) {
      return NextResponse.json(
        {
          error: "no_script",
          message: "Set up your script in the Script Builder before testing.",
        },
        { status: 422 }
      );
    }

    const systemPrompt = buildSystemPrompt(scriptConfig, calendlyUrl, {
      isPlayground: true,
      voiceProfile: userProfile.voice_profile,
    });

    // Cap at 20 messages — same as production webhook
    const cappedMessages = messages.slice(-20);

    const reply = await generateReply(systemPrompt, cappedMessages);

    const hasBookingLink = calendlyUrl
      ? reply.includes(calendlyUrl)
      : reply.includes("{{BOOKING_LINK}}");

    return NextResponse.json({ reply, hasBookingLink });
  } catch (err) {
    console.error("Playground API error:", err);
    return NextResponse.json(
      { error: "Failed to generate response. Please try again." },
      { status: 500 }
    );
  }
}
