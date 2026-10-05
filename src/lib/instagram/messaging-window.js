// Leaf module, no imports. Instagram's standard messaging window.
//
// Meta lets a business message a person only within 24 hours of that
// person's last message to the business. Sending outside it fails at best
// and risks a policy flag on the app at worst, and the app's Meta approval
// is what the product runs on. So the window is enforced inside the send
// functions themselves (sendInstagramMessage, sendInstagramAudio,
// sendVoiceMessage): no caller can skip it.
//
// Deliberately NOT used to extend anything: we never send message tags
// (HUMAN_AGENT or any other). HUMAN_AGENT is for real human replies only,
// and using it on AI replies is a policy violation.
//
// Not applied to private replies to comments (sendPrivateReplyToComment):
// those are addressed by comment_id under Meta's separate 7-day comment
// rule, not by this window.

export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000;

// Shown when a dashboard reply is refused for being outside the window.
export const WINDOW_CLOSED_MESSAGE = "Reply window closed. Reply from the Instagram app.";

export class MessagingWindowClosedError extends Error {
  constructor(lastInboundAt) {
    super("Instagram messaging window closed (more than 24h since the lead's last message)");
    this.name = "MessagingWindowClosedError";
    this.code = "messaging_window_closed";
    this.lastInboundAt = lastInboundAt ?? null;
  }
}

/**
 * Is the window open? `lastInboundAt` is when the LEAD last messaged us
 * (messages.role = 'user', source = 'lead'), not the conversation's
 * last_message_at, which also moves on our own outbound messages.
 *
 * Fails closed: a missing or unparseable time means closed. A conversation
 * the lead never messaged (outbound-first) can't be messaged by the API.
 *
 * @param {string|number|Date|null|undefined} lastInboundAt
 * @param {number} [now] - ms since epoch, for tests
 */
export function isWithinMessagingWindow(lastInboundAt, now = Date.now()) {
  if (lastInboundAt == null) return false;
  const t = lastInboundAt instanceof Date ? lastInboundAt.getTime() : new Date(lastInboundAt).getTime();
  if (!Number.isFinite(t)) return false;
  return now - t < MESSAGING_WINDOW_MS;
}

/**
 * Throws MessagingWindowClosedError unless the window is open. Called at the
 * top of every Send API function before any network request.
 */
export function assertWithinMessagingWindow(lastInboundAt, now = Date.now()) {
  if (!isWithinMessagingWindow(lastInboundAt, now)) {
    throw new MessagingWindowClosedError(lastInboundAt);
  }
}
