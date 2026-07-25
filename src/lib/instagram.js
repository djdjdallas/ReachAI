/**
 * instagram.js
 *
 * Meta Instagram Graph API helpers for sending/receiving DMs via the
 * Instagram Login OAuth flow.
 */

import { REQUIRED_WEBHOOK_FIELDS } from "@/lib/instagram-webhook-fields";

const GRAPH_API_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ── OAuth ───────────────────────────────────────────────────────────────

/**
 * Builds the Instagram Login OAuth URL.
 * Uses Instagram Login (not Facebook Login) to match instagram_business_* permissions.
 *
 * @param {string} state - CSRF state token
 * @returns {string}
 */
export function getOAuthUrl(state) {
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;
  // instagram_business_manage_comments powers comment-to-DM. It is requested at
  // connect time so it appears on the Instagram consent screen and the coach
  // grants it during OAuth.
  const scopes = [
    "instagram_business_basic",
    "instagram_business_manage_messages",
    "instagram_business_manage_comments",
  ].join(",");

  return `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${state}`;
}

/**
 * Exchanges an Instagram OAuth code for a short-lived token, then upgrades to long-lived (60 days).
 *
 * @param {string} code
 * @returns {Promise<{accessToken: string, expiresIn: number, userId: string}>}
 */
export async function exchangeCodeForToken(code) {
  if (!process.env.INSTAGRAM_APP_SECRET) {
    throw new Error("INSTAGRAM_APP_SECRET is not set in the environment");
  }
  if (!process.env.INSTAGRAM_APP_ID) {
    throw new Error("INSTAGRAM_APP_ID is not set in the environment");
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

  // Step 1: Exchange code for short-lived token via Instagram API
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
    cache: "no-store",
  });

  const shortData = await shortRes.json();

  if (shortData.error_type || shortData.error_message || shortData.error) {
    throw new Error(
      `Instagram token exchange failed: ${
        shortData.error_message ||
        shortData.error?.message ||
        shortData.error_type
      }`
    );
  }

  // Meta wraps the Instagram Login short-lived response in a `data` array in
  // some rollouts; handle both the flat and wrapped shapes.
  const shortPayload = shortData?.data?.[0] || shortData;
  const shortAccessToken = shortPayload.access_token;
  const userId = shortPayload.user_id;

  if (!shortAccessToken) {
    throw new Error("Instagram token exchange returned no access_token");
  }

  // Step 2: Exchange short-lived token for long-lived token via Instagram Graph API
  const longParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    access_token: shortAccessToken,
  });

  const longRes = await fetch(
    `https://graph.instagram.com/access_token?${longParams}`,
    { method: "GET", cache: "no-store" }
  );
  const longData = await longRes.json();

  if (longData.error) {
    throw new Error(`Instagram long-lived token failed: ${longData.error.message}`);
  }

  return {
    accessToken: longData.access_token,
    expiresIn: longData.expires_in || 5184000,
    userId: String(userId),
  };
}

/**
 * Refreshes a long-lived Instagram user access token before it expires.
 */
export async function refreshLongLivedToken(currentToken) {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken,
  });

  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params}`);
  const data = await res.json();

  if (data.error) {
    // Surface Meta's structured error so callers can distinguish a genuinely
    // dead token (OAuthException / code 190 — user revoked, switched to a
    // personal account, or the 60-day token lapsed) from a transient hiccup
    // (5xx, rate limit) that should simply be retried on the next cron tick.
    const err = new Error(`Instagram token refresh failed: ${data.error.message}`);
    err.metaCode = data.error.code;
    err.metaType = data.error.type;
    err.metaSubcode = data.error.error_subcode;
    throw err;
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 5184000,
  };
}

// ── Pages & Instagram Account Discovery ─────────────────────────────────

/**
 * Fetches Facebook Pages the user manages, with their Instagram Business accounts.
 */
export async function getUserPagesWithInstagram(userAccessToken) {
  const res = await fetch(
    `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
  );
  const data = await res.json();

  if (data.error) {
    throw new Error(`Failed to fetch pages: ${data.error.message}`);
  }

  return (data.data || []).map((page) => ({
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    instagramAccountId: page.instagram_business_account?.id || null,
  }));
}

/**
 * Subscribes a Facebook Page to receive webhook events (messages, etc.).
 * Field list comes from the canonical constant in
 * src/lib/instagram-webhook-fields.js.
 */
export async function subscribePageToWebhooks(pageId, pageAccessToken) {
  const res = await fetch(
    `${GRAPH_BASE}/${pageId}/subscribed_apps?subscribed_fields=${REQUIRED_WEBHOOK_FIELDS.join(",")}&access_token=${pageAccessToken}`,
    { method: "POST" }
  );
  const data = await res.json();

  if (data.error) {
    throw new Error(`Failed to subscribe page to webhooks: ${data.error.message}`);
  }

  return data;
}

// ── Messaging ───────────────────────────────────────────────────────────

/**
 * Sends a text message via the Instagram Messaging API.
 *
 * @param {string} igAccountId - The Instagram Business Account ID (acts as sender)
 * @param {string} recipientId - The Instagram-scoped user ID (IGSID) of the recipient
 * @param {string} text - The message text
 * @param {string} pageAccessToken - The Page Access Token
 */
export async function sendInstagramMessage(igAccountId, recipientId, text, pageAccessToken) {
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${igAccountId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.error("Instagram send message error:", data.error);
    throw new Error(`Failed to send Instagram message: ${data.error.message}`);
  }

  return data;
}

/**
 * Sends a sender action (mark_seen / typing_on / typing_off) via the
 * Instagram Messaging API. Same endpoint and token path as
 * sendInstagramMessage. Throws on Meta errors so callers can log, but the
 * reply path must treat this as fire-and-forget UX polish — never await it
 * on the critical path and never let a failure block a reply.
 *
 * @param {string} igAccountId - The Instagram Business Account ID (acts as sender)
 * @param {string} recipientId - The Instagram-scoped user ID (IGSID) of the recipient
 * @param {"mark_seen"|"typing_on"|"typing_off"} action
 * @param {string} pageAccessToken - The decrypted Page Access Token
 */
export async function sendSenderAction(igAccountId, recipientId, action, pageAccessToken) {
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${igAccountId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      sender_action: action,
    }),
  });

  const data = await res.json();

  if (data.error) {
    throw new Error(`Failed to send sender action ${action}: ${data.error.message}`);
  }

  return data;
}

/**
 * Sends a pre-recorded audio attachment via the Instagram Messaging API.
 *
 * Mirrors sendInstagramMessage but delivers an audio attachment from a
 * URL Meta can fetch server-side. The URL must be reachable without
 * auth and long-lived enough to survive Meta's retry behavior (10-minute
 * signed URLs are the floor).
 *
 * @param {string} igAccountId      - Instagram Business Account ID (sender)
 * @param {string} recipientId      - The recipient IGSID
 * @param {string} audioUrl         - Publicly fetchable URL to the audio file
 * @param {string} pageAccessToken  - Decrypted Page Access Token
 */
export async function sendInstagramAudio(igAccountId, recipientId, audioUrl, pageAccessToken) {
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${igAccountId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: {
        attachment: { type: "audio", payload: { url: audioUrl } },
      },
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.error("Instagram send audio error:", data.error);
    throw new Error(`Failed to send Instagram audio: ${data.error.message}`);
  }

  return data;
}

/**
 * Sends a private reply to an Instagram comment via Meta's Messaging API.
 *
 * Uses the same /{igAccountId}/messages endpoint as sendInstagramMessage,
 * but addresses the recipient by comment_id rather than IGSID. Required for
 * comment-to-DM where we never see the commenter's IGSID directly.
 *
 * Meta enforces a 7-day window from the comment timestamp. After that, the
 * Graph API returns error code 100 / subcode 2018278 ("comment is older
 * than 7 days"). We also surface the "cannot reply to your own comment"
 * case (subcode 2018065) and rate-limit errors so the caller can store an
 * actionable reason in comment_to_dm_log.dispatch_error.
 *
 * @param {string} igAccountId    - Instagram Business Account ID
 * @param {string} commentId      - The comment we're privately replying to
 * @param {string} text           - Message text
 * @param {string} pageAccessToken - Decrypted Page Access Token
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, retryable?: boolean}>}
 */
export async function sendPrivateReplyToComment(igAccountId, commentId, text, pageAccessToken) {
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${igAccountId}/messages`;
  let data;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        recipient: { comment_id: commentId },
        message: { text },
      }),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    return { success: false, error: `network_error:${err?.message || "unknown"}`, retryable: true };
  }

  if (data?.error) {
    const code = data.error.code;
    const subcode = data.error.error_subcode;
    const message = data.error.message || "unknown_error";
    console.error("Instagram private-reply error:", { code, subcode, message });

    if (code === 100 && subcode === 2018278) {
      return { success: false, error: "stale_comment", retryable: false };
    }
    if (code === 10 && subcode === 2018065) {
      return { success: false, error: "self_comment", retryable: false };
    }
    // Meta's rate-limit family: 4 (app), 17 (user), 32 (page), 613 (custom),
    // plus the explicit "rate limited" subcode 2018109. Treat all as
    // retryable so a future queue worker can re-attempt with backoff.
    if (code === 4 || code === 17 || code === 32 || code === 613 || subcode === 2018109) {
      return { success: false, error: "rate_limited", retryable: true };
    }
    return { success: false, error: message, retryable: false };
  }

  return {
    success: true,
    messageId: data?.message_id || data?.id || null,
  };
}

/**
 * Posts a PUBLIC reply under an Instagram comment.
 *
 * Endpoint: POST /{ig-comment-id}/replies with message={text}. This is the
 * public half of instagram_business_manage_comments — the reply appears as
 * a visible child comment under the trigger comment, unlike
 * sendPrivateReplyToComment which lands in the commenter's DMs.
 *
 * Returns the same result-object shape as sendPrivateReplyToComment so
 * callers can log outcomes without try/catch around the transport. Never
 * throws.
 *
 * @param {string} commentId      - The comment to reply under
 * @param {string} text           - Public reply text
 * @param {string} pageAccessToken - Decrypted Page Access Token
 * @returns {Promise<{success: boolean, replyId?: string, error?: string, retryable?: boolean}>}
 */
export async function postPublicCommentReply(commentId, text, pageAccessToken) {
  const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${commentId}/replies`;
  let data;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({ message: text }),
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    return { success: false, error: `network_error:${err?.message || "unknown"}`, retryable: true };
  }

  if (data?.error) {
    const code = data.error.code;
    const subcode = data.error.error_subcode;
    const message = data.error.message || "unknown_error";
    console.error("Instagram public-reply error:", { code, subcode, message });

    // Same rate-limit family as the private-reply path.
    if (code === 4 || code === 17 || code === 32 || code === 613) {
      return { success: false, error: "rate_limited", retryable: true };
    }
    return { success: false, error: message, retryable: false };
  }

  return { success: true, replyId: data?.id || null };
}

// ── Webhook Verification ────────────────────────────────────────────────

/**
 * Verifies the SHA-256 signature on incoming Meta webhook requests.
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.INSTAGRAM_APP_SECRET)
    .update(rawBody, "utf-8")
    .digest("hex");

  const expectedFull = `sha256=${expected}`;

  // Use constant-time comparison to prevent timing attacks
  if (expectedFull.length !== signatureHeader.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(expectedFull),
    Buffer.from(signatureHeader)
  );
}

// ── Profile Helpers ─────────────────────────────────────────────────────

/**
 * Fetches a participant's profile (name, profile pic) for display in the dashboard.
 */
export async function getParticipantProfile(userId, accessToken) {
  try {
    const url = `https://graph.instagram.com/${GRAPH_API_VERSION}/${userId}?fields=name,username,profile_pic&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error("Failed to fetch participant profile:", data.error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("getParticipantProfile error:", err.message);
    return null;
  }
}
