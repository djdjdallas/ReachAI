// When the AI can't be reached (an Anthropic call failed: any 4xx/5xx or a
// timeout, e.g. the 2026-10-08 400 "credit balance is too low"), managed
// accounts (users.billing_managed) get a person instead of silence:
//   - the comment or DM is handed off: handoff_requested (reason "other")
//     lands in the clinic's Needs attention
//   - nothing is sent to the lead
//   - the operator is emailed, at most once per hour per account
// Coach accounts keep their old behavior; callers check isBillingManaged.

import { emitCommentHandoff, emitThreadHandoff } from "@/lib/outbound-webhooks/emit";
import { sendBusinessEventAlert } from "@/lib/alerts/business-events";

export const AI_UNAVAILABLE_NOTE = "AI unavailable, needs a reply";
export const ALERT_EVENT_TYPE = "ai_unavailable_alert";
export const ALERT_INTERVAL_MS = 60 * 60 * 1000;

/** A short, safe description of the failed call: status and Anthropic's message. */
export function describeAiError(err) {
  const status = err?.status ?? err?.statusCode ?? null;
  const message = String(err?.error?.error?.message || err?.message || "unknown error").replace(/\s+/g, " ").slice(0, 200);
  return status ? `${status} ${message}` : message;
}

/**
 * Email the operator that the AI is down for this account, at most once per
 * hour per account. The throttle is an email_events row (event_type
 * 'ai_unavailable_alert'; the in-app notification feed doesn't list it).
 * Never throws.
 *
 * @param {object} admin
 * @param {{user: object, stage: "comment_classification"|"comment_reply"|"dm_reply", error: unknown, now?: number}} args
 * @returns {Promise<{alerted: boolean}>}
 */
export async function alertAiUnavailable(admin, { user, stage, error, now = Date.now() }) {
  try {
    if (!user?.id) return { alerted: false };
    const since = new Date(now - ALERT_INTERVAL_MS).toISOString();
    const { data: recent, error: readErr } = await admin
      .from("email_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_type", ALERT_EVENT_TYPE)
      .gte("sent_at", since)
      .limit(1);
    if (readErr) console.warn("[ai-unavailable] alert throttle read failed:", readErr.code);
    if (recent?.length) return { alerted: false };
    const detail = describeAiError(error);
    await admin.from("email_events").insert({
      user_id: user.id,
      event_type: ALERT_EVENT_TYPE,
      metadata: { stage, error: detail },
      sent_at: new Date(now).toISOString(),
    });
    await sendBusinessEventAlert("ai_unavailable", {
      email: user.email || null,
      businessName: user.business_name || null,
      userId: user.id,
      stage,
      error: detail,
    });
    return { alerted: true };
  } catch (err) {
    console.error("[ai-unavailable] alert failed:", err?.message);
    return { alerted: false };
  }
}

/**
 * A comment the AI couldn't handle: handoff_requested about the
 * commenter's thread when they have one, otherwise a comment-only lead.
 * Never throws.
 */
export async function handOffCommentAiUnavailable(admin, { userId, classificationId, fromId, fromUsername }) {
  try {
    const { data: conv } = fromId
      ? await admin.from("conversations").select("id").eq("user_id", userId).eq("instagram_sender_id", fromId).maybeSingle()
      : { data: null };
    return await emitCommentHandoff(admin, {
      userId,
      classificationId,
      conversationId: conv?.id || null,
      instagramUsername: fromUsername,
      reason: "other",
    });
  } catch (err) {
    console.error("[ai-unavailable] comment handoff failed:", err?.message);
    return { emitted: false };
  }
}

/**
 * A DM the AI couldn't answer: handoff_requested about the thread, once per
 * thread per hour (a lead sending three messages during an outage is one
 * item in Needs attention). Never throws.
 */
export function handOffDmAiUnavailable(admin, { userId, conversationId, now = Date.now() }) {
  const hour = new Date(now).toISOString().slice(0, 13);
  return emitThreadHandoff(admin, {
    userId,
    conversationId,
    dedupeKey: `handoff_requested:ai_unavailable:${conversationId}:${hour}`,
    reason: "other",
  });
}
