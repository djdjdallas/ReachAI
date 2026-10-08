// Clinic accounts (users.business_name set): every clinic-specific decision
// in the comment-to-DM pipeline. src/lib/webhooks/comment-event.js calls
// these only for clinic accounts; coach accounts never reach this module,
// and src/lib/webhooks/coach-snapshot.test.js holds their behavior fixed.
//
// The rules:
//   - {{TREATMENT}} renders the post's tagged treatment (treatment.js), and
//     a comment-to-DM thread on a tagged post seeds treatment_interest.
//   - A complaint (CRITICAL_NEGATIVE, or a bad outcome, side effect or
//     refund: complaint.js) never gets a DM, whatever the post's per-class
//     actions say. It is handed to a person.
//   - A comment with an intent signal (intent.js: it names one of the
//     account's treatments or the post's tagged one, or says an interest
//     phrase like "how much" or "love to") gets the HIGH_INTENT decision,
//     whatever the classifier called it, unless it is a complaint, spam or
//     personal. The classifier often calls these UNCERTAIN on clinic posts
//     ("I would love to check you guys out... Botox").
//   - Praise and fan comments (ENGAGED_NOT_BUYING) without a signal are
//     ignored: no DM, no handoff.
//   - A comment queued for review that might be a real inquiry
//     (HIGH_INTENT below the DM confidence bar or with no usable template,
//     or UNCERTAIN) is handed to a person.
// A handoff is handoff_requested (reason "other"), which lands in the
// clinic's Needs attention. There is no per-comment email.

import { emitCommentHandoff } from "@/lib/outbound-webhooks/emit";
import { looksLikeComplaint } from "./complaint";
import { hasClinicIntentSignal } from "./intent";
import { postTreatment, renderTreatmentTokens } from "./treatment";

// Classes whose queued comments might be a real inquiry.
const INQUIRY_CLASSES = new Set(["HIGH_INTENT", "UNCERTAIN"]);
// Classes an intent signal never overrides: spam that names a treatment,
// or a personal message, is still not a lead.
const NO_INTENT_OVERRIDE = new Set(["SPAM", "NOT_A_LEAD"]);

/**
 * Before the decision: the post's treatment, and the templates with
 * {{TREATMENT}} rendered.
 *
 * @param {{ownerUser: object, monitoringRow: object, templates: Record<string, string>}} args
 * @returns {{treatmentKey: string|null, templates: Record<string, string>}}
 */
export function prepareClinicComment({ ownerUser, monitoringRow, templates }) {
  const treatment = postTreatment(ownerUser, monitoringRow?.treatment_key);
  const rendered = {};
  for (const [cls, template] of Object.entries(templates || {})) {
    rendered[cls] = renderTreatmentTokens(template, treatment?.label || null);
  }
  return { treatmentKey: treatment?.key || null, templates: rendered };
}

/**
 * After the decision: the clinic rules above. Complaints and handed-off
 * comments are logged as queue_review, so the activity views show them.
 *
 * @param {object} args
 * @param {object} args.classification
 * @param {string} args.commentText
 * @param {{action: string, rendered: string|null, reason: string}} args.decision - the shared decision
 * @param {object} [args.ownerUser] - users row (treatment_categories), for the intent signal
 * @param {string|null} [args.treatmentKey] - the post's treatment tag
 * @param {() => object} [args.decideHighIntent] - the shared decision for this comment as HIGH_INTENT
 * @returns {{decision: object, handoff: "complaint"|"inquiry"|null}}
 */
export function applyClinicCommentRules({ classification, commentText, decision, ownerUser = null, treatmentKey = null, decideHighIntent = null }) {
  const cls = classification?.class;
  if (cls === "CRITICAL_NEGATIVE" || looksLikeComplaint(commentText)) {
    return { decision: { action: "queue_review", rendered: null, reason: "clinic_complaint" }, handoff: "complaint" };
  }
  if (
    decideHighIntent &&
    decision.action !== "dm" &&
    !NO_INTENT_OVERRIDE.has(cls) &&
    hasClinicIntentSignal({ ownerUser, treatmentKey, commentText })
  ) {
    const high = decideHighIntent();
    return {
      decision: { ...high, reason: `clinic_intent_signal:${high.reason}` },
      // No HIGH_INTENT template (or the post queues HIGH_INTENT): a person.
      handoff: high.action === "queue_review" ? "inquiry" : null,
    };
  }
  if (cls === "ENGAGED_NOT_BUYING") {
    return { decision: { action: "ignore", rendered: null, reason: "clinic_praise_ignored" }, handoff: null };
  }
  if (decision.action === "queue_review" && INQUIRY_CLASSES.has(cls)) {
    return { decision, handoff: "inquiry" };
  }
  return { decision, handoff: null };
}

/**
 * Hand a comment to the clinic: handoff_requested (reason "other"). About
 * the commenter's DM thread when they have one, otherwise a comment-only
 * lead. Never throws.
 *
 * @param {object} admin - service-role client
 * @param {{userId: string, classificationId: string, fromId: string|null, fromUsername: string|null}} args
 */
export async function handOffClinicComment(admin, { userId, classificationId, fromId, fromUsername }) {
  try {
    const { data: conv } = fromId
      ? await admin
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("instagram_sender_id", fromId)
          .maybeSingle()
      : { data: null };
    await emitCommentHandoff(admin, {
      userId,
      classificationId,
      conversationId: conv?.id || null,
      instagramUsername: fromUsername,
      reason: "other",
    });
  } catch (err) {
    console.error("[clinic-comment] handoff failed:", { classificationId, error: err?.message });
  }
}
