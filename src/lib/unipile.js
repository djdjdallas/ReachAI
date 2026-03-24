import { UnipileClient } from "unipile-node-sdk";

let client = null;

export function getUnipileClient() {
  if (!client) {
    const dsn = process.env.UNIPILE_DSN;
    const apiKey = process.env.UNIPILE_API_KEY;

    if (!dsn || !apiKey) {
      throw new Error(
        "UNIPILE_DSN and UNIPILE_API_KEY environment variables are required"
      );
    }

    client = new UnipileClient(dsn, apiKey);
  }
  return client;
}

export async function sendUnipileMessage(chatId, text) {
  const c = getUnipileClient();
  return c.messaging.sendMessage({ chat_id: chatId, text });
}

export async function startNewChat(accountId, attendeeId, text) {
  const c = getUnipileClient();
  return c.messaging.startNewChat({
    account_id: accountId,
    attendees_ids: [attendeeId],
    text,
  });
}

export async function getUnipileHostedAuthLink(callbackUrl, webhookUrl) {
  const c = getUnipileClient();
  return c.account.createHostedAuthLink({
    type: "create",
    providers_restricted: ["INSTAGRAM"],
    success_redirect_url: callbackUrl,
    failure_redirect_url: callbackUrl + "?error=auth_failed",
    notify_url: webhookUrl,
  });
}

export async function disconnectAccount(accountId) {
  const c = getUnipileClient();
  return c.account.delete(accountId);
}
