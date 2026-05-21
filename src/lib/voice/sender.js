import { decryptToken } from "@/lib/token-utils";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const GRAPH_API_VERSION = "v21.0";

/**
 * Sends a pre-recorded voice memo via the Instagram Messaging API.
 *
 * Meta payload shape:
 *   {
 *     recipient: { id: '<IGSID>' },
 *     message: {
 *       attachment: { type: 'audio', payload: { url: '<signed_url>' } }
 *     }
 *   }
 *
 * Auth: Page Access Token via Authorization: Bearer. Meta will fetch the
 * audio URL server-side, so the URL must be reachable without auth and
 * long-lived enough to survive retries (10-minute floor — see
 * getSendableAudioUrl).
 *
 * @param {object} args
 * @param {string} args.igUserId               - Instagram Business Account ID (acts as sender)
 * @param {string} args.encryptedAccessToken   - encrypted Page Access Token from users.meta_page_access_token
 * @param {string} args.recipientPsid          - the lead's IGSID
 * @param {string} args.audioUrl               - publicly fetchable signed URL
 */
export async function sendVoiceMessage({
  igUserId,
  encryptedAccessToken,
  recipientPsid,
  audioUrl,
}) {
  if (!igUserId || !recipientPsid || !audioUrl) {
    throw new Error("sendVoiceMessage: missing required arguments");
  }

  const accessToken = decryptToken(encryptedAccessToken);
  if (!accessToken) {
    throw new Error("sendVoiceMessage: access token unavailable");
  }

  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${igUserId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: {
        attachment: { type: "audio", payload: { url: audioUrl } },
      },
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data.error) {
    const message =
      data?.error?.message || `IG audio send failed with status ${res.status}`;
    console.error("[voice/sender] Instagram audio send error:", {
      code: data?.error?.code,
      subcode: data?.error?.error_subcode,
      message,
    });
    throw new Error(`Failed to send Instagram voice message: ${message}`);
  }

  return data;
}

/**
 * Logs the outcome of a voice-send attempt to voice_send_log. When the
 * status is 'sent' AND a voice_snippet_id is provided, also bumps the
 * snippet's send_count via the increment_voice_send_count RPC.
 *
 * @param {object} args
 * @param {string} args.userId
 * @param {string|null} args.voiceSnippetId
 * @param {string|null} args.conversationId
 * @param {string} args.recipientPsid
 * @param {string} args.intentClass
 * @param {('sent'|'failed'|'fallback_text'|'skipped_kill_switch'|'skipped_do_not_send')} args.status
 * @param {string} [args.errorMessage]
 */
export async function logVoiceSend({
  userId,
  voiceSnippetId,
  conversationId,
  recipientPsid,
  intentClass,
  status,
  errorMessage,
}) {
  const supabase = getSupabaseAdmin();

  try {
    await supabase.from("voice_send_log").insert({
      user_id: userId,
      voice_snippet_id: voiceSnippetId || null,
      conversation_id: conversationId || null,
      recipient_psid: recipientPsid,
      intent_class: intentClass,
      send_status: status,
      error_message: errorMessage || null,
    });
  } catch (err) {
    console.error("[voice/sender] logVoiceSend insert failed:", err?.message);
  }

  if (status === "sent" && voiceSnippetId) {
    try {
      await supabase.rpc("increment_voice_send_count", {
        snippet_id: voiceSnippetId,
      });
    } catch (err) {
      console.error(
        "[voice/sender] increment_voice_send_count RPC failed:",
        err?.message
      );
    }
  }
}
