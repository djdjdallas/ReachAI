// Reads a coach's enabled knowledge entries for the reply prompt.

const FIELDS = "id, type, question, answer, enabled, sort, created_at";

/**
 * @param {object} supabase - a client that can read knowledge_entries for
 *   this user (the reply paths pass the service-role client)
 * @param {string} userId
 * @returns {Promise<Array<object>>} [] when there are none or the read fails.
 *   Grounding is best-effort: a reply must never fail on it. With [] the
 *   prompt carries no block and no missing-knowledge handoff rule, which is
 *   the pre-knowledge-base behavior; the medical rule always applies.
 */
export async function getKnowledgeEntries(supabase, userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from("knowledge_entries")
      .select(FIELDS)
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[knowledge] read failed:", error.code);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("[knowledge] read threw:", err?.message);
    return [];
  }
}
