// Persists a successfully-dispatched comment-to-DM into the conversation
// system so (a) the lead's reply matches an existing thread and the AI sees
// the opening DM as history, and (b) the DM is traceable in the inbox — not
// just on the activity log.
//
// Why a dedicated helper: there is no reusable "outbound conversation
// creator" to import — the regular outreach flow inlines the same logic in
// src/app/api/outreach/start/route.js, and the inbound webhook's idempotent
// message inserter (insertMessageIfNew) is private to that route and coupled
// to its native-send/backfill logic. Rather than alter the inbound matching
// path (explicitly out of bounds), this mirrors those two established
// patterns in one place and stays scoped to the comment-to-DM use.
//
// Conformance to the inbound matcher (src/app/api/webhooks/instagram):
//   inbound replies resolve a conversation on (user_id, instagram_sender_id)
//   where instagram_sender_id = event.sender.id (the commenter's IGSID). The
//   only IGSID we hold at comment-DM dispatch is value.from.id from the
//   comment webhook — on the Instagram API with Instagram Login these are the
//   same Instagram-scoped ID for the same user+app, so writing it here is
//   what lets the reply match instead of orphaning.
//
// Contract: NEVER throws. The DM has already been sent by the time we get
// here; a conversation/message write failure must never re-throw (Meta would
// re-deliver the webhook and re-send the DM) and must never crash the job —
// every failure path logs and returns.

export async function persistCommentDmConversation({
  admin,
  userId,
  recipientIgsid,
  senderName,
  renderedDm,
  providerMessageId,
}) {
  try {
    // Without the recipient IGSID there is no key the inbound reply can match
    // on. Writing a row anyway would either orphan the thread or, worse,
    // duplicate it once the real reply arrives with the true sender id. The
    // send itself is already audited in comment_to_dm_log, so skip cleanly.
    if (!recipientIgsid) {
      console.warn("[comment-dm-conversation] no recipient IGSID — skipping persistence", {
        userId,
      });
      return;
    }

    // Find-or-create on the SAME key the inbound webhook matches on. If the
    // lead already has a thread (e.g. they DM'd first, then commented), append
    // to it — never create a second.
    const conversation = await findOrCreateConversation(admin, {
      userId,
      recipientIgsid,
      senderName,
    });
    if (!conversation) return;

    // Exactly one assistant message, idempotent on provider_message_id so a
    // retried dispatch never duplicates it.
    if (providerMessageId) {
      const { data: existing } = await admin
        .from("messages")
        .select("id")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();
      if (existing) return;
    }

    const { data: inserted, error: msgErr } = await admin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: renderedDm,
        source: "agent",
        provider_message_id: providerMessageId,
      })
      .select("created_at")
      .single();

    // 23505 = unique violation: a concurrent dispatch inserted the same
    // provider_message_id first. Treat as already-persisted.
    if (msgErr) {
      if (msgErr.code !== "23505") {
        console.error("[comment-dm-conversation] message insert failed:", {
          userId,
          conversationId: conversation.id,
          code: msgErr.code,
        });
      }
      return;
    }

    const { error: bumpErr } = await admin
      .from("conversations")
      .update({ last_message_at: inserted?.created_at || new Date().toISOString() })
      .eq("id", conversation.id);
    if (bumpErr) {
      console.error("[comment-dm-conversation] last_message_at bump failed:", {
        conversationId: conversation.id,
        code: bumpErr.code,
      });
    }
  } catch (err) {
    console.error("[comment-dm-conversation] threw:", {
      userId,
      error: err?.message,
    });
  }
}

async function findOrCreateConversation(admin, { userId, recipientIgsid, senderName }) {
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("instagram_sender_id", recipientIgsid)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      user_id: userId,
      instagram_sender_id: recipientIgsid,
      // Clinchd sends first, so there is no real thread yet — initialize
      // instagram_thread_id to the IGSID exactly as the canonical outbound
      // path (outreach/start) does. Do NOT invent a thread id.
      instagram_thread_id: recipientIgsid,
      status: "qualifying",
      ai_paused: false,
      sender_name: senderName,
      origin: "clinchd_sent",
      // We have the full opening DM as a message below, so the thread is not
      // missing outbound context (no backfill banner).
      missing_outbound_context: false,
    })
    .select("id")
    .single();

  if (created) return created;

  // 23505 = a concurrent webhook created the row between our select and
  // insert. Re-select so we append rather than fail.
  if (error?.code === "23505") {
    const { data: raced } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("instagram_sender_id", recipientIgsid)
      .maybeSingle();
    return raced || null;
  }

  console.error("[comment-dm-conversation] conversation create failed:", {
    userId,
    code: error?.code,
  });
  return null;
}
