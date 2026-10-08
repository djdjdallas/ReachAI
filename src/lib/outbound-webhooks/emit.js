// Server-side emit for events with no database trigger behind them. Mirrors
// public.outbound_emit: one outbox row when the account has an enabled
// webhook subscribed to the type, and a repeated dedupe key is a no-op.
//
// Used by the comment-to-DM path for handoff_requested on comments that
// got no DM (src/lib/webhooks/comment-event.js). The pause trigger can't
// cover those: often there is no conversation to pause.

import { HANDOFF_REASONS } from "./events";
import { validUsername } from "./lead-capture";

/**
 * A comment on a persona account needs a person. Emits handoff_requested.
 *
 * With a conversation (the commenter already has a DM thread), the event is
 * about that thread's lead. Without one, the lead is the comment itself:
 * lead.id "cmt_<classification id>", with the commenter's username
 * (docs/outbound-webhooks.md, comment-only leads).
 *
 * Never throws.
 *
 * @param {object} admin - service-role client
 * @param {{userId: string, classificationId: string, conversationId?: string|null, instagramUsername?: string|null, reason?: string}} args
 * @returns {Promise<{emitted: boolean}>}
 */
export async function emitCommentHandoff(admin, { userId, classificationId, conversationId = null, instagramUsername = null, reason = "other" }) {
  try {
    if (!userId || !classificationId) return { emitted: false };
    const { data: hook, error: hookErr } = await admin
      .from("outbound_webhooks")
      .select("enabled, event_types")
      .eq("user_id", userId)
      .maybeSingle();
    if (hookErr || !hook?.enabled || !(hook.event_types || []).includes("handoff_requested")) {
      return { emitted: false };
    }

    const data = { reason: HANDOFF_REASONS.includes(reason) ? reason : "other" };
    if (!conversationId) {
      const username = validUsername(instagramUsername);
      data.comment_lead = { id: classificationId, ...(username ? { instagram_username: username } : {}) };
    }

    const { error } = await admin.from("outbound_webhook_events").upsert(
      {
        user_id: userId,
        event_type: "handoff_requested",
        // One comment hands off once, however often Meta re-delivers it.
        dedupe_key: `handoff_requested:comment:${classificationId}`,
        conversation_id: conversationId,
        data,
      },
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
    );
    if (error) {
      console.warn("[outbound-emit] comment handoff insert failed:", error.code);
      return { emitted: false };
    }
    return { emitted: true };
  } catch (err) {
    console.warn("[outbound-emit] comment handoff threw:", err?.message);
    return { emitted: false };
  }
}
