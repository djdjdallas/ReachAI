import { log } from "@/lib/logger";
import { getPostHogClient } from "@/lib/posthog-server";

// Link a native_send_outbound record to an existing conversation: claim the
// row by setting matched_conversation_id (idempotent via the IS NULL guard),
// inject the original DM as the first assistant message in the thread, set
// origin='native_send', and clear missing_outbound_context.
//
// Used by:
//   - POST /api/native-send  (dashboard pre-log opportunistic backfill)
//   - POST /api/native-send/backfill (in-thread banner save, step 6)
//
// `admin` must be a service-role Supabase client so all three writes can
// proceed without depending on the calling user's RLS context. The user_id
// scope is enforced explicitly in the WHERE clauses below.
export async function attachToConversation(admin, {
  userId,
  userEmail,
  conversationId,
  nativeSendId,
  dmText,
  sentAt,
}) {
  const { data: claimedRows, error: claimError } = await admin
    .from("native_send_outbound")
    .update({ matched_conversation_id: conversationId })
    .eq("id", nativeSendId)
    .eq("user_id", userId)
    .is("matched_conversation_id", null)
    .select("id");
  if (claimError) {
    log.error("[native-send] backfill claim failed:", claimError.code);
    return null;
  }
  // 0 rows = the row was already matched (most likely the webhook's
  // match_and_claim_native_send beat us to it). Skip the inject — the
  // winning path has already done it. Treat this as a no-op success.
  if (!claimedRows || claimedRows.length === 0) {
    log.info("[native-send] backfill skipped — row already claimed");
    return { conversationId, alreadyClaimed: true };
  }

  const { error: injectError } = await admin.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: dmText,
    source: "native_send",
    created_at: sentAt,
  });
  if (injectError) {
    log.error("[native-send] backfill inject failed:", injectError.code);
    return null;
  }

  const { error: convError } = await admin
    .from("conversations")
    .update({ origin: "native_send", missing_outbound_context: false })
    .eq("id", conversationId)
    .eq("user_id", userId);
  if (convError) {
    log.error("[native-send] backfill conv update failed:", convError.code);
    return null;
  }

  getPostHogClient().capture({
    distinctId: userEmail || userId,
    event: "native_send_backfilled",
    properties: { conversation_id: conversationId, native_send_id: nativeSendId },
  });

  return { conversationId };
}
