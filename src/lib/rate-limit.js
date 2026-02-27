/**
 * Returns a random delay between min and max milliseconds
 * to make outgoing DMs feel more human-like.
 */
export function getHumanDelay(min = 1000, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if user has exceeded their monthly DM limit.
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
    base: 500,
    unlimited: Infinity,
  };

  return {
    used: count || 0,
    limit: limits[plan] || 500,
    exceeded: (count || 0) >= (limits[plan] || 500),
  };
}
