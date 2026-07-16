import { sendEmail, sendSms } from "@/lib/notifications";

/**
 * Founder-facing business-event alerts: signup, Instagram connect (including
 * the loud account-CHANGED case from the July 14 incident), subscription
 * started, subscription canceled.
 *
 * Design rules:
 * - NEVER throws to the caller. sendEmail/sendSms already never throw, and
 *   the whole body is wrapped again so even a template bug can't propagate
 *   into signup, OAuth, or Stripe webhook processing. Callers still invoke
 *   fire-and-forget with .catch(console.error) per convention.
 * - Email goes to the founder via the existing ALERT_EMAIL || ADMIN_EMAIL
 *   convention (src/lib/tokens/reconnect.js, /api/alerts/notify).
 * - SMS (existing sendSms helper) fires only for the two money events and
 *   only when ALERT_PHONE is set; silently skipped otherwise.
 * - Plaintext bodies; the <pre> wrapper is only so Resend's HTML field
 *   preserves line breaks — no templating.
 */

const FOUNDER_EMAIL =
  process.env.ALERT_EMAIL ||
  process.env.ADMIN_EMAIL ||
  "dominickjerell@gmail.com";

const FOUNDER_PHONE = process.env.ALERT_PHONE || null;

const SMS_EVENTS = new Set(["subscription_started", "subscription_canceled"]);

function escapeHtml(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]
  );
}

// Prefer @username, fall back to the raw IGBA id, then a placeholder.
function igLabel(username, igba) {
  if (username) return `@${username}`;
  if (igba) return String(igba);
  return "unknown";
}

function formatAmount(amountCents) {
  if (typeof amountCents !== "number") return "unknown";
  return `$${(amountCents / 100).toFixed(2)}`;
}

function compose(event, p) {
  switch (event) {
    case "signup":
      return {
        subject: `[clinchd] new signup: ${p.email || "unknown email"}`,
        body: [
          `email: ${p.email || "unknown"}`,
          `auth provider: ${p.provider || "unknown"}`,
          `plan: ${p.plan || "unknown"} (${p.subscriptionStatus || "unknown"})`,
          `created: ${p.createdAt || "unknown"}`,
        ].join("\n"),
      };

    case "instagram_connected": {
      const changed = !!p.oldIgba && p.oldIgba !== p.newIgba;
      const oldLabel = igLabel(p.oldUsername, p.oldIgba);
      const newLabel = igLabel(p.newUsername, p.newIgba);
      // Three shapes: a blocked swap ATTEMPT (guard refused it, user must
      // confirm), a completed CHANGE, and a plain first/same connect. The
      // founder must be able to tell from the subject alone whether the
      // connection actually moved.
      let subject;
      if (changed && p.blocked) {
        subject = `[clinchd] ⚠️ instagram account change BLOCKED (needs confirmation): ${oldLabel} → ${newLabel} (${p.email || "unknown email"})`;
      } else if (changed) {
        subject = `[clinchd] ⚠️ instagram account CHANGED: ${oldLabel} → ${newLabel} (${p.email || "unknown email"})`;
      } else {
        subject = `[clinchd] instagram connected: ${newLabel} (${p.email || "unknown email"})`;
      }
      return {
        subject,
        body: [
          `email: ${p.email || "unknown"}`,
          p.oldIgba
            ? `old account: ${oldLabel} (IGBA ${p.oldIgba})`
            : "old account: none (first connect)",
          `new account: ${newLabel} (IGBA ${p.newIgba || "unknown"})`,
          ...(changed && p.blocked
            ? ["status: BLOCKED — connection unchanged, awaiting user confirmation"]
            : []),
          `time: ${new Date().toISOString()}`,
        ].join("\n"),
      };
    }

    case "subscription_started":
      return {
        subject: `[clinchd] 💳 new subscriber: ${p.email || "unknown email"} — ${p.plan || "unknown"}`,
        body: [
          `email: ${p.email || "unknown"}`,
          `plan: ${p.plan || "unknown"}`,
          `amount: ${formatAmount(p.amountTotal)}`,
          `stripe customer: ${p.stripeCustomerId || "unknown"}`,
        ].join("\n"),
      };

    case "subscription_canceled": {
      const n = p.conversationCount ?? "unknown";
      return {
        subject: `[clinchd] 🔻 cancellation: ${p.email || "unknown email"} — ${p.plan || "unknown"} — ${n} lifetime conversations`,
        body: [
          `email: ${p.email || "unknown"}`,
          `plan: ${p.plan || "unknown"}`,
          `lifetime conversations: ${n}`,
          `signed up: ${p.signupDate || "unknown"}`,
          `stripe customer: ${p.stripeCustomerId || "unknown"}`,
        ].join("\n"),
      };
    }

    default:
      return null;
  }
}

/**
 * @param {"signup"|"instagram_connected"|"subscription_started"|"subscription_canceled"} event
 * @param {object} payload - event-specific fields, see compose()
 */
export async function sendBusinessEventAlert(event, payload = {}) {
  try {
    const composed = compose(event, payload);
    if (!composed) {
      console.error("[business-alert] unknown event:", event);
      return;
    }

    await sendEmail({
      to: FOUNDER_EMAIL,
      subject: composed.subject,
      html: `<pre>${escapeHtml(composed.body)}</pre>`,
    });

    if (FOUNDER_PHONE && SMS_EVENTS.has(event)) {
      await sendSms({ to: FOUNDER_PHONE, body: composed.subject });
    }
  } catch (err) {
    console.error("[business-alert] send failed:", event, err?.message);
  }
}
