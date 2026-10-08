import { sendEmail } from "@/lib/notifications";

/**
 * Customer-facing handoff email: tells the ACCOUNT OWNER that the AI stepped
 * back from a conversation and it now needs their personal attention.
 *
 * This is deliberately separate from src/lib/alerts/business-events.js —
 * that module targets the FOUNDER address and must never be reused for
 * customer mail.
 *
 * Design rules (same contract as the founder alerts):
 * - NEVER throws to the caller. sendEmail already never throws and the whole
 *   body is wrapped again, so a Resend outage is invisible to webhook
 *   processing. Callers invoke fire-and-forget with .catch(console.error).
 * - Fires only for pauses a human must act on: the two hands-to-human
 *   reasons, the two knowledge handoffs (medical_question,
 *   missing_knowledge: the lead was told the owner will get back to them),
 *   plus do_not_send pauses for hostility/refund/legal and crisis
 *   (see OWNER_ALERT_PAUSE_REASONS in src/lib/dm-intent-gate.js). Injection
 *   and spam do_not_send pauses stay silent, and manual takeover was the
 *   human's own action — neither should email.
 * - The caller guards the false→true ai_paused transition, so a retried
 *   webhook delivery can't produce a duplicate email.
 * - Plaintext body; the <pre> wrapper only preserves line breaks in Resend's
 *   HTML field — no templating.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://clinchd.io";

const REASON_COPY = {
  complex_objection:
    "this one has a question that deserves your personal touch",
  qualifying_loop_detected:
    "the conversation was going in circles, so the AI stepped back instead of repeating itself",
  hostile_or_refund:
    "this message looked hostile or mentioned a refund, chargeback, or legal issue, so the AI stopped replying",
  crisis_signal:
    "this message may be from someone going through something hard, so the AI stopped replying. Please check in personally",
};

// Knowledge handoffs. What the lead was told depends on whether the holding
// text actually went out (it can be rate limited, or the send can fail).
const KNOWLEDGE_REASON_COPY = {
  medical_question: {
    sent: "they asked a health-related question, which the AI never answers. It told them you'd get back to them",
    notSent: "they asked a health-related question, which the AI never answers. The AI stopped replying, so please reply to them yourself",
  },
  missing_knowledge: {
    sent: "they asked about a price, availability, or a policy that isn't in your business knowledge. The AI told them you'd get back to them. Add the answer in Settings > Business knowledge so it can answer next time",
    notSent: "they asked about a price, availability, or a policy that isn't in your business knowledge. The AI stopped replying, so please reply to them yourself. Add the answer in Settings > Business knowledge so it can answer next time",
  },
};

// Health questions are sensitive: the email never quotes them. The owner
// reads the message in the app.
const NO_EXCERPT_REASONS = new Set(["medical_question"]);

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
}

function snippet(text, max = 200) {
  const t = String(text || "").trim();
  if (!t) return "(no message text)";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * @param {object} params
 * @param {object} params.user - public.users row (needs email)
 * @param {object} params.conversation - conversations row (needs id, sender_name)
 * @param {"complex_objection"|"qualifying_loop_detected"|"hostile_or_refund"|"crisis_signal"|"medical_question"|"missing_knowledge"} params.reason
 * @param {string} params.leadMessage - the lead's latest message text (never
 *   included for medical_question)
 * @param {boolean} [params.holdingSent] - knowledge handoffs only: whether
 *   the holding text reached the lead
 */
export async function sendHandoffEmail({ user, conversation, reason, leadMessage, holdingSent = false }) {
  try {
    if (!user?.email || !conversation?.id) return;

    const knowledge = KNOWLEDGE_REASON_COPY[reason];
    const why = knowledge ? (holdingSent ? knowledge.sent : knowledge.notSent) : REASON_COPY[reason];
    if (!why) {
      console.error("[handoff-email] unknown reason, not sending:", reason);
      return;
    }

    const senderName = conversation.sender_name || "A lead";
    const conversationUrl = `${APP_URL}/conversations?thread=${conversation.id}`;

    const body = [
      `The AI just handed you a conversation with ${senderName} — ${why}.`,
      "",
      ...(NO_EXCERPT_REASONS.has(reason)
        ? ["They asked a health-related question. Open the conversation to read it."]
        : ["Their last message:", `"${snippet(leadMessage)}"`]),
      "",
      "Pick up the conversation here:",
      conversationUrl,
      "",
      "The AI stays paused on this thread until you resume it, so nothing goes out without you.",
    ].join("\n");

    await sendEmail({
      to: user.email,
      subject: `A conversation needs you: ${senderName}`,
      html: `<pre style="font-family:inherit;white-space:pre-wrap;margin:0;">${escapeHtml(body)}</pre>`,
    });
  } catch (err) {
    console.error("[handoff-email] send failed:", err?.message);
  }
}

const COMMENT_REASON_COPY = {
  complaint:
    "it looks like a complaint, a bad outcome, a side effect, or a refund request, so no DM was sent",
  needs_review:
    "the AI wasn't sure enough to DM them, so nothing was sent",
};

/**
 * A comment on a watched post that got no DM and needs a person (persona
 * accounts). Same contract as sendHandoffEmail: never throws. The comment
 * is public on Instagram, so the email quotes it.
 *
 * @param {object} params
 * @param {object} params.user - public.users row (needs email)
 * @param {"complaint"|"needs_review"} params.reason
 * @param {string|null} params.commenterUsername
 * @param {string} params.commentText
 * @param {string|null} [params.postPermalink] - the post on Instagram
 * @param {string|null} [params.postId] - posts.id, for the activity page
 * @param {string|null} [params.conversationId] - the commenter's DM thread, when they have one
 */
export async function sendCommentAttentionEmail({ user, reason, commenterUsername, commentText, postPermalink = null, postId = null, conversationId = null }) {
  try {
    if (!user?.email) return;
    const why = COMMENT_REASON_COPY[reason];
    if (!why) {
      console.error("[handoff-email] unknown comment reason, not sending:", reason);
      return;
    }
    const who = commenterUsername ? `@${commenterUsername}` : "Someone";
    const links = [];
    if (postPermalink) links.push("The post on Instagram:", postPermalink);
    if (conversationId) links.push("Their DM thread in Clinchd:", `${APP_URL}/conversations?thread=${conversationId}`);
    else if (postId) links.push("Comment activity in Clinchd:", `${APP_URL}/comment-to-dm/activity/${postId}`);

    const body = [
      `${who} commented on one of your watched posts and it needs you: ${why}.`,
      "",
      "Their comment:",
      `"${snippet(commentText)}"`,
      "",
      ...links,
      "",
      "Reply to them yourself on Instagram (a reply to the comment, or a DM).",
    ].join("\n");

    await sendEmail({
      to: user.email,
      subject: `A comment needs you: ${who}`,
      html: `<pre style="font-family:inherit;white-space:pre-wrap;margin:0;">${escapeHtml(body)}</pre>`,
    });
  } catch (err) {
    console.error("[handoff-email] comment email failed:", err?.message);
  }
}
