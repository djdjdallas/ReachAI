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
  if (!process.env.INSTAGRAM_APP_SECRET) {
    throw new Error("INSTAGRAM_APP_SECRET is not set in the environment");
  }
  if (!process.env.INSTAGRAM_APP_ID) {
    throw new Error("INSTAGRAM_APP_ID is not set in the environment");
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;
  const mask = (s) =>
    typeof s === "string" && s.length > 8
      ? `${s.slice(0, 4)}…${s.slice(-4)}`
      : "***";

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
  console.log("[ig-oauth] short-lived response:", {
    status: shortRes.status,
    ok: shortRes.ok,
    // Don't log the token itself, but log the shape + mask
    shape: Array.isArray(shortData?.data) ? "data-array" : "flat",
    keys: Object.keys(shortData || {}),
  });

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
    console.error(
      "[ig-oauth] short-lived exchange returned no access_token. Raw:",
      shortData
    );
    throw new Error("Instagram token exchange returned no access_token");
  }

  // Step 2: Exchange short-lived token for long-lived token via Instagram Graph API
  const longParams = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.INSTAGRAM_APP_SECRET,
    access_token: shortAccessToken,
  });

  console.log("[ig-oauth] long-lived exchange:", {
    url: "https://graph.instagram.com/access_token",
    method: "GET",
    grant_type: "ig_exchange_token",
    client_secret: mask(process.env.INSTAGRAM_APP_SECRET),
    access_token: mask(shortAccessToken),
  });

  const longRes = await fetch(
    `https://graph.instagram.com/access_token?${longParams}`,
    { method: "GET", cache: "no-store" }
  );
  const longData = await longRes.json();

  console.log("[ig-oauth] long-lived response:", {
    status: longRes.status,
    ok: longRes.ok,
    body: longData,
  });

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
