/**
 * instagram.js
 *
 * Meta Instagram Graph API helpers for sending/receiving DMs.
 * Used for users connected via Meta's official OAuth flow.
 * Unipile remains as a fallback for legacy connections.
 */

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
  const scopes = [
    "instagram_business_basic",
    "instagram_business_manage_messages",
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
  });

  const shortData = await shortRes.json();

  if (shortData.error_type || shortData.error_message) {
    throw new Error(`Instagram token exchange failed: ${shortData.error_message || shortData.error_type}`);
  }

  const userId = shortData.user_id;

  // Step 2: Exchange short-lived token for long-lived token via Instagram Graph API
  const longParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    access_token: shortData.access_token,
  });

  const longRes = await fetch(`https://graph.instagram.com/access_token?${longParams}`);
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
    throw new Error(`Instagram token refresh failed: ${data.error.message}`);
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
 */
export async function subscribePageToWebhooks(pageId, pageAccessToken) {
  const res = await fetch(
    `${GRAPH_BASE}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageAccessToken}`,
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
  const res = await fetch(`${GRAPH_BASE}/${igAccountId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      access_token: pageAccessToken,
    }),
  });

  const data = await res.json();

  if (data.error) {
    console.error("Instagram send message error:", data.error);
    throw new Error(`Failed to send Instagram message: ${data.error.message}`);
  }

  return data;
}

// ── Webhook Verification ────────────────────────────────────────────────

/**
 * Verifies the SHA-256 signature on incoming Meta webhook requests.
 */
export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;

  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", process.env.FACEBOOK_APP_SECRET)
    .update(rawBody)
    .digest("hex");

  return signatureHeader === `sha256=${expected}`;
}

// ── Profile Helpers ─────────────────────────────────────────────────────

/**
 * Fetches a participant's profile (name, profile pic) for display in the dashboard.
 */
export async function getParticipantProfile(userId, accessToken) {
  try {
    const res = await fetch(
      `${GRAPH_BASE}/${userId}?fields=name,profile_pic&access_token=${accessToken}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
