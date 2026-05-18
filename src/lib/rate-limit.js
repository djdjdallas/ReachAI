import { NextResponse } from "next/server";

/**
 * Returns a random delay between min and max milliseconds
 * to make outgoing DMs feel more human-like.
 */
export function getHumanDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Per-user/per-endpoint hourly rate limit. Backed by the `ai_call_log` table
 * and the `check_ai_rate` RPC (migration 015). Call at the top of each AI
 * handler with the authenticated user's id; if this returns a NextResponse,
 * short-circuit the handler and return it.
 *
 * @param {object} supabaseAdmin - service-role client (getSupabaseAdmin())
 * @param {string} userId
 * @param {string} endpoint - short label, e.g. "ai_reply", "voice_chat"
 * @param {number} maxPerHour
 * @returns {Promise<NextResponse|null>} - 429 response when over the cap, else null
 */
export async function enforceAiRateLimit(supabaseAdmin, userId, endpoint, maxPerHour) {
  try {
    const { data: allowed, error } = await supabaseAdmin.rpc("check_ai_rate", {
      uid: userId,
      ep: endpoint,
      max_per_hour: maxPerHour,
    });
    if (error) {
      // Fail-open: we don't want a Supabase blip to take down paid features.
      console.error("check_ai_rate RPC error:", error.message);
      return null;
    }
    if (allowed === false) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: `Hourly limit reached for this feature (max ${maxPerHour}/hr). Try again later.`,
        },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error("enforceAiRateLimit threw:", err?.message);
  }
  return null;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if user has exceeded their monthly conversation limit.
 */
export async function checkDmLimit(supabase, userId, plan = "base") {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "assistant")
    .gte("created_at", startOfMonth.toISOString())
    .eq("conversation_id.user_id", userId);

  const limits = {
    base: 1500,
    unlimited: Infinity,
  };

  return {
    used: count || 0,
    limit: limits[plan] || 1500,
    exceeded: (count || 0) >= (limits[plan] || 1500),
  };
}
