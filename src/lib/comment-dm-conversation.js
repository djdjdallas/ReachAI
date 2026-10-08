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

import { captureLeadFacts } from "@/lib/outbound-webhooks/lead-capture";

export async function persistCommentDmConversation({
  admin,
  userId,
  recipientIgsid,
  senderName,
  renderedDm,
  providerMessageId,
  commentText,
  // The DM that just went out carried the first-message AI disclosure.
  disclosedNow = false,
  // The treatment tagged on the post (persona accounts): seeds the lead's
  // treatment_interest ahead of matching the comment text.
  treatmentKey = null,
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
      disclosedNow,
    });
    if (!conversation) return;

    // The disclosure went out, so record it on the thread. A new thread was
    // created with disclosed_at set; one that already existed (Meta's echo
    // created it first, or the lead DM'd at the same moment) is claimed here
    // if nobody has.
    if (disclosedNow && !conversation.created) {
      await admin
        .from("conversations")
        .update({ disclosed_at: new Date().toISOString() })
        .eq("id", conversation.id)
        .is("disclosed_at", null);
    }

    // Outbound webhooks: the commenter's username and a treatment category,
    // the post's tag or else one matched in the comment (accounts with an
    // enabled webhook only). Never throws.
    await captureLeadFacts(admin, {
      userId,
      conversationId: conversation.id,
      text: commentText,
      instagramUsername: senderName,
      treatmentKey,
    });

    // Exactly one assistant message, idempotent on provider_message_id so a
    // retried dispatch never duplicates it.
    if (providerMessageId) {
      const { data: existing } = await admin
        .from("messages")
        .select("id, source, conversation_id")
        .eq("provider_message_id", providerMessageId)
        .maybeSingle();
      if (existing) {
        await reconcileEchoedOpener(admin, { message: existing, conversation });
        return;
      }
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

// Meta's echo of this DM can arrive before the send call returns. The echo
// handler then saves the opener as a staff-typed message (source 'manual')
// and, if the lead had no thread, creates one as origin 'native_send'. Both
// are wrong for a DM the app sent: the opener would read as the owner's own
// words, the disclosure check and the lifecycle webhooks would miss it, and
// the thread would get cold-DM framing. Relabel them. The thread is only
// relabeled when this opener is all it holds, so a real cold-DM thread the
// clinic started by hand is never touched.
async function reconcileEchoedOpener(admin, { message, conversation }) {
  try {
    if (message.conversation_id !== conversation.id) return;
    if (message.source === "manual") {
      await admin.from("messages").update({ source: "agent" }).eq("id", message.id).eq("source", "manual");
    }
    if (conversation.origin === "native_send") {
      const { data: others } = await admin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .neq("id", message.id)
        .limit(1);
      if (!others?.length) {
        await admin
          .from("conversations")
          .update({ origin: "clinchd_sent", missing_outbound_context: false })
          .eq("id", conversation.id)
          .eq("origin", "native_send");
      }
    }
  } catch (err) {
    console.error("[comment-dm-conversation] echo reconcile failed:", { conversationId: conversation.id, error: err?.message });
  }
}

async function findOrCreateConversation(admin, { userId, recipientIgsid, senderName, disclosedNow = false }) {
  const { data: existing } = await admin
    .from("conversations")
    .select("id, origin")
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
      // Born 'new' (untriaged) like every conversation; the DM intent
      // classifier promotes the status when the lead's first reply lands.
      status: "new",
      ai_paused: false,
      sender_name: senderName,
      origin: "clinchd_sent",
      // We have the full opening DM as a message below, so the thread is not
      // missing outbound context (no backfill banner).
      missing_outbound_context: false,
      ...(disclosedNow ? { disclosed_at: new Date().toISOString() } : {}),
    })
    .select("id, origin")
    .single();

  if (created) return { ...created, created: true };

  // 23505 = a concurrent webhook created the row between our select and
  // insert. Re-select so we append rather than fail.
  if (error?.code === "23505") {
    const { data: raced } = await admin
      .from("conversations")
      .select("id, origin")
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
