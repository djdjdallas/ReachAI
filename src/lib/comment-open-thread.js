// Comment DMs to a lead who already has a thread, managed accounts only
// (users.billing_managed). Coach accounts never reach this module.
//
//   paused  the thread is paused (ai_paused) or taken over (status
//           'manual'): a person has it. Skip the DM.
//   active  the lead sent a message in the last 6 hours: they're chatting
//           right now. Skip the DM.
//   quiet   anything else: the lead went quiet. No generic template; the
//           caller sends a contextual reply instead
//           (src/lib/comment-contextual-reply.js).
// No thread: null, and the template opener goes out as before.
//
// Skips are logged as comment_to_dm_log.decided_action
// "dm_skipped_open_thread" with the state. Only DM decisions get here: a
// complaint was already routed to a handoff.

export const ACTIVE_LEAD_WINDOW_MS = 6 * 60 * 60 * 1000;

/**
 * The commenter's thread and its state, or null when they have none. Read
 * errors count as no thread: the comment is handled as it would have been
 * before this check.
 *
 * @param {object} admin - service-role client
 * @param {{userId: string, igsid: string|null, now?: number}} args
 * @returns {Promise<{conversation: object, state: "paused"|"active"|"quiet"}|null>}
 */
export async function findLeadThread(admin, { userId, igsid, now = Date.now() }) {
  try {
    if (!igsid) return null;
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, ai_paused, status, origin, sender_name, disclosed_at, missing_outbound_context")
      .eq("user_id", userId)
      .eq("instagram_sender_id", igsid)
      .maybeSingle();
    if (!conversation) return null;
    if (conversation.ai_paused === true || conversation.status === "manual") {
      return { conversation, state: "paused" };
    }
    const { data: recent } = await admin
      .from("messages")
      .select("id")
      .eq("conversation_id", conversation.id)
      .eq("role", "user")
      .eq("source", "lead")
      .gte("created_at", new Date(now - ACTIVE_LEAD_WINDOW_MS).toISOString())
      .limit(1);
    return { conversation, state: recent?.length ? "active" : "quiet" };
  } catch (err) {
    console.warn("[comment-open-thread] check failed:", err?.message);
    return null;
  }
}
