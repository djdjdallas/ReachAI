// Open-thread skip for comment DMs, managed accounts only
// (users.billing_managed). A commenter already in a conversation with the
// account doesn't get the comment template dropped into it: the comment DM
// is skipped (comment_to_dm_log.decided_action "dm_skipped_open_thread")
// when their thread
//   - is paused (ai_paused: a person has it), or
//   - had any message, from either side, in the last 7 days.
// An older, quiet thread gets the DM as before. Only DM decisions are
// checked: a complaint has already been routed to a handoff by then.
// Coach accounts never reach this module.

export const OPEN_THREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The commenter's open thread, or null when there is none (no thread, or
 * an old quiet one). Read errors count as no open thread: the DM goes out
 * as it would have before this check.
 *
 * @param {object} admin - service-role client
 * @param {{userId: string, igsid: string|null, now?: number}} args
 * @returns {Promise<{conversationId: string, reason: "paused"|"recent"}|null>}
 */
export async function findOpenThread(admin, { userId, igsid, now = Date.now() }) {
  try {
    if (!igsid) return null;
    const { data: conv } = await admin
      .from("conversations")
      .select("id, ai_paused")
      .eq("user_id", userId)
      .eq("instagram_sender_id", igsid)
      .maybeSingle();
    if (!conv) return null;
    if (conv.ai_paused === true) return { conversationId: conv.id, reason: "paused" };
    const { data: recent } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conv.id)
      .gte("created_at", new Date(now - OPEN_THREAD_WINDOW_MS).toISOString())
      .limit(1);
    return recent?.length ? { conversationId: conv.id, reason: "recent" } : null;
  } catch (err) {
    console.warn("[comment-open-thread] check failed:", err?.message);
    return null;
  }
}
