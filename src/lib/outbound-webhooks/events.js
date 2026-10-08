// Outbound lifecycle webhooks: event types and the retry schedule. Leaf
// module, no imports. Contract: docs/outbound-webhooks.md.

export const CONTRACT_VERSION = "1";

// Lifecycle events, in funnel order, then lead_updated (a lead field
// changed; no stage meaning). 'test' is sent only by the admin script.
export const LIFECYCLE_EVENT_TYPES = Object.freeze([
  "new_inquiry",
  "dm_started",
  "contact_captured",
  "booking_link_sent",
  "consultation_booked",
  "follow_up_sent",
  "handoff_requested",
  "lead_updated",
]);
export const EVENT_TYPES = Object.freeze([...LIFECYCLE_EVENT_TYPES, "test"]);

export const HANDOFF_REASONS = Object.freeze([
  "medical_question",
  "missing_knowledge",
  "human_requested",
  "other",
]);

// Attempt 1 goes out on the next cron tick (the cron runs every minute);
// each later attempt waits this long after the previous failure. Five
// attempts in all, then 'failed' (replayable by event id).
export const RETRY_DELAYS_MS = Object.freeze([60_000, 300_000, 1_800_000, 7_200_000]);
export const MAX_ATTEMPTS = RETRY_DELAYS_MS.length + 1;
const JITTER = 0.2;

/**
 * When to try again after a failed attempt, or null when attempts are used up.
 *
 * @param {number} attempts - attempts made so far, including the one that failed
 * @param {number} [now]
 * @param {() => number} [random] - 0..1, for tests
 * @returns {Date|null}
 */
export function nextAttemptAt(attempts, now = Date.now(), random = Math.random) {
  if (attempts >= MAX_ATTEMPTS) return null;
  const base = RETRY_DELAYS_MS[Math.max(0, attempts - 1)];
  const jitter = base * JITTER * (random() * 2 - 1);
  return new Date(now + Math.round(base + jitter));
}

/** The public event id for an outbox row id. */
export function publicEventId(rowId) {
  return `evt_${rowId}`;
}

/** The outbox row id for a public event id, or null when it isn't one. */
export function rowIdFromEventId(eventId) {
  const m = /^evt_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    String(eventId || "").trim()
  );
  return m ? m[1].toLowerCase() : null;
}
