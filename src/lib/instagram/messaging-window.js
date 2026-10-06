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

/**
 * When the lead's message was sent, for measuring the window (audit LM1):
 * the EARLIER of Meta's event timestamp and our receipt time.
 *
 * Receipt time alone is wrong for a delayed or retried webhook delivery:
 * a message sent 23h59m ago and delivered now would look brand new, and a
 * reply would go out after the real window closed. The event timestamp
 * alone is wrong if it's in the future (sender clock, bad payload), which
 * would stretch the window. The minimum is never later than either.
 *
 * Meta's messaging timestamp is ms since epoch; a value that looks like
 * seconds is scaled. A missing or invalid timestamp falls back to receipt.
 *
 * @param {number|string|null|undefined} eventTimestamp - event.timestamp
 * @param {number} receivedAtMs - Date.now() at webhook receipt
 * @returns {number} ms since epoch
 */
export function inboundAtMs(eventTimestamp, receivedAtMs) {
  let t = Number(eventTimestamp);
  if (!Number.isFinite(t) || t <= 0) return receivedAtMs;
  if (t < 1e12) t *= 1000;
  return Math.min(t, receivedAtMs);
}
