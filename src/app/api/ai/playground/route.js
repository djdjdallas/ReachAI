import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { generateReply } from "@/lib/anthropic";
import { buildSystemPrompt } from "@/lib/prompts";
import { ownerFromUser } from "@/lib/active-offer";
import { loadReplyGrounding } from "@/lib/reply-grounding";
import { holdingTextFor } from "@/lib/handoff-reply";
import { lintReply } from "@/lib/reply-lint";
import { enforceAiRateLimit } from "@/lib/rate-limit";

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
 *   hasBookingLink: boolean,
 *   handoff?: "medical_question" | "missing_knowledge"  // reply is the holding text
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

    const rl = await enforceAiRateLimit(
      getSupabaseAdmin(),
      user.id,
      "playground",
      30
    );
    if (rl) return rl;

    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const { data: userProfile, error: profileError } = await getSupabaseAdmin()
      .from("users")
      .select("id, script_config, calendly_url, voice_profile, full_name, instagram_username")
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

    const { activeOffer, knowledge } = await loadReplyGrounding(
      getSupabaseAdmin(),
      userProfile.id
    );
    const systemPrompt = buildSystemPrompt(scriptConfig, calendlyUrl, {
      isPlayground: true,
      voiceProfile: userProfile.voice_profile,
      activeOffer,
      knowledge,
      owner: ownerFromUser(userProfile),
    });

    // Cap at 20 messages — same as production webhook
    const cappedMessages = messages.slice(-20);

    // Same pre-send filter as the live reply paths, so the owner tests
    // exactly what a lead would receive.
    const lint = lintReply(await generateReply(systemPrompt, cappedMessages), {
      bookingLink: calendlyUrl,
    });
    // A knowledge handoff shows the owner exactly what a lead would get (the
    // fixed holding text) plus why, so they can see the AI would hand off.
    if (lint.handoff) {
      return NextResponse.json({
        reply: holdingTextFor(userProfile),
        hasBookingLink: false,
        handoff: lint.handoff.category,
      });
    }
    const reply = lint.text;

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
