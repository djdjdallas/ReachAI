const getDsn = () => process.env.UNIPILE_DSN;
const getApiKey = () => process.env.UNIPILE_API_KEY;

function headers() {
  return {
    "X-API-KEY": getApiKey(),
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function unipileFetch(path, options = {}) {
  const url = `${getDsn()}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...headers(), ...options.headers },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    console.error(`Unipile ${options.method || "GET"} ${path} failed:`, res.status, body);
    throw new Error(
      `Unipile API error ${res.status}: ${JSON.stringify(body)}`
    );
  }

  return body;
}

export async function sendUnipileMessage(chatId, text) {
  return unipileFetch(`/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function startNewChat(accountId, attendeeId, text) {
  return unipileFetch("/chats", {
    method: "POST",
    body: JSON.stringify({
      account_id: accountId,
      attendees_ids: [attendeeId],
      text,
    }),
  });
}

export async function getUnipileHostedAuthLink(callbackUrl, webhookUrl) {
  // expiresOn: link expires in 1 hour
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace(/(\.\d{3})\d*Z$/, "$1Z");

  return unipileFetch("/hosted/accounts/link", {
    method: "POST",
    body: JSON.stringify({
      type: "create",
      api_url: getDsn(),
      providers: ["INSTAGRAM"],
      expiresOn,
      success_redirect_url: callbackUrl,
      failure_redirect_url: callbackUrl + "&error=auth_failed",
      notify_url: webhookUrl,
    }),
  });
}

export async function disconnectAccount(accountId) {
  return unipileFetch(`/accounts/${accountId}`, {
    method: "DELETE",
  });
}
