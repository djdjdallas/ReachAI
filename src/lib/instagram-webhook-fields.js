/**
 * Canonical list of Instagram webhook fields Clinchd subscribes to.
 *
 * LEAF MODULE — no server-only imports, safe for both client and server.
 * Every place that subscribes or verifies a subscription must trace to this
 * constant (OAuth callback, connection-health endpoint, legacy Pages helper).
 * scripts/resubscribe-instagram-webhooks.mjs mirrors it with a pointer
 * comment because the standalone node script can't import app ESM modules.
 *
 * IMPORTANT: this list must match what's declared in the Meta App Dashboard.
 * - `comments` requires the `instagram_business_manage_comments` permission
 *   to be approved. Until then, Meta accepts the subscription but only
 *   delivers `messages` and `messaging_postbacks` events in production.
 * - `message_echoes` delivers messages SENT BY the connected account —
 *   including DMs the coach types in the Instagram app — so the webhook can
 *   persist manual openers.
 */
export const REQUIRED_WEBHOOK_FIELDS = [
  "messages",
  "messaging_postbacks",
  "comments",
  "message_echoes",
];

/**
 * Compares Meta's reported `subscribed_fields` against the canonical list.
 * Returns the fields that should be subscribed but aren't (empty = healthy).
 */
export function missingWebhookFields(subscribedFields) {
  const have = new Set(Array.isArray(subscribedFields) ? subscribedFields : []);
  return REQUIRED_WEBHOOK_FIELDS.filter((field) => !have.has(field));
}
