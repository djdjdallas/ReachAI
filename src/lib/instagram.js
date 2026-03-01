const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export async function getInstagramProfile(accessToken) {
  const res = await fetch(
    `${GRAPH_API_BASE}/me?fields=id,name,instagram_business_account&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error("Failed to fetch Instagram profile");
  return res.json();
}

export async function getConversations(igUserId, accessToken) {
  const res = await fetch(
    `${GRAPH_API_BASE}/${igUserId}/conversations?platform=instagram&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

export async function getMessages(conversationId, accessToken) {
  const res = await fetch(
    `${GRAPH_API_BASE}/${conversationId}/messages?fields=message,from,created_time&access_token=${accessToken}`
  );
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

// Fix 9: Fetch participant profile to get sender_name
export async function getParticipantProfile(userId, accessToken) {
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${userId}?fields=name,profile_pic&access_token=${accessToken}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function sendMessage(igUserId, recipientId, message, accessToken) {
  const res = await fetch(`${GRAPH_API_BASE}/${igUserId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
      access_token: accessToken,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Failed to send message: ${JSON.stringify(error)}`);
  }
  return res.json();
}

export function getOAuthUrl() {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;
  const scopes = [
    "instagram_basic",
    "instagram_manage_messages",
    "pages_show_list",
    "pages_messaging",
  ].join(",");

  return `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;
}

export async function exchangeCodeForToken(code) {
  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const params = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID,
    client_secret: process.env.FACEBOOK_APP_SECRET,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`,
    code,
  });

  const tokenRes = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`
  );
  if (!tokenRes.ok) throw new Error("Failed to exchange code for token");
  return tokenRes.json();
}

export async function getLongLivedToken(shortLivedToken) {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: process.env.FACEBOOK_APP_ID,
    client_secret: process.env.FACEBOOK_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(
    `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`
  );
  if (!res.ok) throw new Error("Failed to get long-lived token");
  return res.json();
}
