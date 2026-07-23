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
 * - Fires only for the two hands-to-human pause reasons. The do-not-send
 *   pause is spam suppression, not a handoff, and manual takeover was the
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
};

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
 * @param {"complex_objection"|"qualifying_loop_detected"} params.reason
 * @param {string} params.leadMessage - the lead's latest message text
 */
export async function sendHandoffEmail({ user, conversation, reason, leadMessage }) {
  try {
    if (!user?.email || !conversation?.id) return;

    const why = REASON_COPY[reason];
    if (!why) {
      console.error("[handoff-email] unknown reason, not sending:", reason);
      return;
    }

    const senderName = conversation.sender_name || "A lead";
    const conversationUrl = `${APP_URL}/conversations?thread=${conversation.id}`;

    const body = [
      `The AI just handed you a conversation with ${senderName} — ${why}.`,
      "",
      "Their last message:",
      `"${snippet(leadMessage)}"`,
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
