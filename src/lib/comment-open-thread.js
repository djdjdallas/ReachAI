// Comment DMs to a lead who already has a thread, managed accounts only
// (users.billing_managed). Coach accounts never reach this module.
//
//   paused  the thread is paused (ai_paused) or taken over (status
//           'manual'): a person has it. Skip the DM.
//   active  the lead sent a message in the last 6 hours: they're chatting
//           right now. Skip the DM.
//   awaiting_reply
//           we sent them something (any outbound: the AI, a drip, the
//           owner) in the last 24 hours and they haven't replied since.
//           Skip the DM: a lead commenting on two posts minutes apart must
//           not get two DMs (live, 2026-10-08: comments 18059428940796919
//           and 17964457908197950, 3.5 minutes apart).
//   quiet   anything else: the lead went quiet and our last outbound is
//           older than 24h (or they replied since). No generic template;
//           the caller sends a contextual reply instead
//           (src/lib/comment-contextual-reply.js).
// No thread: null, and the template opener goes out as before.
//
// Skips are logged as comment_to_dm_log.decided_action
// "dm_skipped_open_thread" with the state. Only DM decisions get here: a
// complaint was already routed to a handoff.

export const ACTIVE_LEAD_WINDOW_MS = 6 * 60 * 60 * 1000;
export const AWAITING_REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The commenter's thread and its state, or null when they have none. Read
 * errors count as no thread: the comment is handled as it would have been
 * before this check.
 *
 * @param {object} admin - service-role client
 * @param {{userId: string, igsid: string|null, now?: number}} args
 * @returns {Promise<{conversation: object, state: "paused"|"active"|"awaiting_reply"|"quiet"}|null>}
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
    // Everything in the last 24h, both sides; the latest of each is
    // compared here (no reliance on server-side ordering).
    const { data: recent } = await admin
      .from("messages")
      .select("role, source, created_at")
      .eq("conversation_id", conversation.id)
      .gte("created_at", new Date(now - AWAITING_REPLY_WINDOW_MS).toISOString())
      .limit(500);
    const latest = (rows) => rows.reduce((max, m) => Math.max(max, Date.parse(m.created_at) || 0), 0);
    const lastLead = latest((recent || []).filter((m) => m.role === "user" && m.source === "lead"));
    const lastOutbound = latest((recent || []).filter((m) => m.role === "assistant"));
    if (lastLead && lastLead >= now - ACTIVE_LEAD_WINDOW_MS) return { conversation, state: "active" };
    if (lastOutbound && lastOutbound > lastLead) return { conversation, state: "awaiting_reply" };
    return { conversation, state: "quiet" };
  } catch (err) {
    console.warn("[comment-open-thread] check failed:", err?.message);
    return null;
  }
}
