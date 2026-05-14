import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { encryptToken, decryptToken } from "@/lib/token-utils";

const AUTH_BASE = "https://auth.calendly.com";
const API_BASE = "https://api.calendly.com";

export function getCalendlyRedirectUri() {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!origin) {
    throw new Error("NEXT_PUBLIC_APP_URL not configured");
  }
  return `${origin}/api/auth/calendly/callback`;
}

export function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID,
    response_type: "code",
    redirect_uri: getCalendlyRedirectUri(),
    state,
  });
  return `${AUTH_BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.CALENDLY_CLIENT_ID,
    client_secret: process.env.CALENDLY_CLIENT_SECRET,
    code,
    redirect_uri: getCalendlyRedirectUri(),
  });

  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Calendly token exchange failed (${res.status}): ${detail}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.CALENDLY_CLIENT_ID,
    client_secret: process.env.CALENDLY_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Calendly token refresh failed (${res.status}): ${detail}`);
  }

  return res.json();
}

export async function getCurrentUser(accessToken) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Calendly /users/me failed (${res.status}): ${detail}`);
  }

  const json = await res.json();
  return json.resource;
}

export async function createWebhookSubscription(accessToken, { organizationUri, userUri }) {
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/calendly`;

  const res = await fetch(`${API_BASE}/webhook_subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: webhookUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: organizationUri,
      user: userUri,
      scope: "user",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const err = new Error(`Calendly webhook subscription failed (${res.status}): ${detail}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }

  const json = await res.json();
  return json.resource;
}

export async function deleteWebhookSubscription(accessToken, webhookUri) {
  const res = await fetch(webhookUri, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Calendly webhook delete failed (${res.status}): ${detail}`);
  }
}

/**
 * Return a valid access token for the user, refreshing + persisting if expired.
 * Caller passes the user row (must include calendly_access_token, calendly_refresh_token,
 * calendly_token_expires_at). Returns the decrypted access token string.
 */
export async function withFreshToken(user) {
  const expiresAt = user.calendly_token_expires_at
    ? new Date(user.calendly_token_expires_at).getTime()
    : 0;
  const needsRefresh = !expiresAt || expiresAt - Date.now() < 60_000;

  if (!needsRefresh) {
    return decryptToken(user.calendly_access_token);
  }

  const refreshToken = decryptToken(user.calendly_refresh_token);
  if (!refreshToken) {
    throw new Error("Calendly refresh token missing");
  }

  const tokens = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const admin = getSupabaseAdmin();
  await admin
    .from("users")
    .update({
      calendly_access_token: encryptToken(tokens.access_token),
      calendly_refresh_token: encryptToken(tokens.refresh_token),
      calendly_token_expires_at: newExpiresAt,
    })
    .eq("id", user.id);

  return tokens.access_token;
}
