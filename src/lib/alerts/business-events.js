import { sendEmail, sendSms } from "@/lib/notifications";
import { SUPPORT_EMAIL } from "@/lib/support";

/**
 * Founder-facing business-event alerts: signup, Instagram connect (including
 * the loud account-CHANGED case from the July 14 incident), subscription
 * started, cancellation requested (still paying until the period ends),
 * subscription canceled, account deleted (self-serve, from Settings).
 *
 * Design rules:
 * - NEVER throws to the caller. sendEmail/sendSms already never throw, and
 *   the whole body is wrapped again so even a template bug can't propagate
 *   into signup, OAuth, or Stripe webhook processing. Callers still invoke
 *   fire-and-forget with .catch(console.error) per convention.
 * - Email goes to the founder at SUPPORT_EMAIL (src/lib/support.js). The
 *   old ALERT_EMAIL / ADMIN_EMAIL env fallbacks are no longer read here.
 *   convention (src/lib/tokens/reconnect.js, /api/alerts/notify).
 * - SMS (existing sendSms helper) fires only for the two money events and
 *   only when ALERT_PHONE is set; silently skipped otherwise.
 * - Plaintext bodies; the <pre> wrapper is only so Resend's HTML field
 *   preserves line breaks — no templating.
 */

const FOUNDER_EMAIL = SUPPORT_EMAIL;

const FOUNDER_PHONE = process.env.ALERT_PHONE || null;

const SMS_EVENTS = new Set([
  "subscription_started",
  "duplicate_subscription_canceled",
  "checkout_unlinked",
  "cancellation_requested",
  "subscription_canceled",
]);

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

// Whole hours since createdAt, one decimal under a day so a same-night
// delete reads as "7.3h" rather than "7h". null when createdAt is missing.
export function accountAgeHours(createdAt, now = Date.now()) {
  const t = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  const hours = Math.max(0, (now - t) / 3_600_000);
  return hours < 24 ? Math.round(hours * 10) / 10 : Math.round(hours);
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

    // Fires when a cancel is first scheduled (customer.subscription.updated
    // sets cancel_at), weeks before subscription_canceled. This is the
    // window to save the customer, so it carries the reason they gave.
    case "cancellation_requested":
      return {
        subject: `[clinchd] ⏳ cancel requested: ${p.email || "unknown email"} (${igLabel(p.instagramUsername)}), ${p.plan || "unknown"}, ends ${p.cancelAt || "unknown"}`,
        body: [
          `email: ${p.email || "unknown"}`,
          `instagram: ${igLabel(p.instagramUsername)}`,
          `plan: ${p.plan || "unknown"}`,
          `access ends: ${p.cancelAt || "unknown"}`,
          `requested at: ${p.canceledAt || "unknown"}`,
          `reason: ${p.reason || "none given"}`,
          `comment: ${p.comment || "none"}`,
          `stripe customer: ${p.stripeCustomerId || "unknown"}`,
        ].join("\n"),
      };

    // Fires from /api/user/delete BEFORE anything is deleted, so the row's
    // details are still readable. The 2026-09-25 self-delete was only found
    // days later in the Supabase auth log.
    case "account_deleted": {
      const age = typeof p.accountAgeHours === "number" ? `${p.accountAgeHours}h` : "unknown";
      return {
        subject: `[clinchd] account deleted: ${p.email || "unknown email"} (${igLabel(p.instagramUsername)}), ${p.plan || "unknown"}/${p.subscriptionStatus || "unknown"}, ${age} old`,
        body: [
          `email: ${p.email || "unknown"}`,
          `instagram: ${igLabel(p.instagramUsername)}`,
          `plan: ${p.plan || "unknown"}`,
          `subscription status: ${p.subscriptionStatus || "unknown"}`,
          `created: ${p.createdAt || "unknown"}`,
          `account age: ${age}`,
          `deleted at: ${new Date().toISOString()}`,
        ].join("\n"),
      };
    }

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

    // checkout.session.completed whose customer doesn't match the user row
    // it names (audit L2): nothing was activated. Usually a Payment Link
    // with a wrong client_reference_id. The customer may have paid, so this
    // needs a human: link the row by hand or refund.
    case "checkout_unlinked":
      return {
        subject: `[clinchd] ⚠️ checkout NOT linked to an account: ${p.stripeCustomerId || "unknown customer"}`,
        body: [
          "A Checkout completed but its customer does not match the user row it names. Nothing was activated.",
          `session: ${p.sessionId || "unknown"}`,
          `stripe customer: ${p.stripeCustomerId || "unknown"}`,
          `user id: ${p.userId || "unknown"} (from ${p.userIdSource || "unknown"})`,
          `user row found: ${p.rowFound ? "yes, different customer" : "no"}`,
          `amount: ${formatAmount(p.amountTotal)}`,
        ].join("\n"),
      };

    // Audit M3: a second live subscription for one customer was refunded
    // and canceled automatically. Worth a personal note to the coach.
    case "duplicate_subscription_canceled": {
      const refunds = Array.isArray(p.refunds) ? p.refunds : [];
      const refunded = refunds.length
        ? refunds.map((r) => `${formatAmount(r.amount)} (${r.id})`).join(", ")
        : "nothing charged yet (trial)";
      return {
        subject: `[clinchd] ⚠️ duplicate subscription canceled: ${p.email || "unknown email"}`,
        body: [
          `email: ${p.email || "unknown"}`,
          `stripe customer: ${p.stripeCustomerId || "unknown"}`,
          `canceled (newer): ${p.canceledSubscriptionId || "unknown"}`,
          `kept (older): ${p.keptSubscriptionId || "unknown"} (${p.keptStatus || "unknown"})`,
          `refunded: ${refunded}`,
          `checkout session: ${p.sessionId || "unknown"}`,
        ].join("\n"),
      };
    }

    default:
      return null;
  }
}

/**
 * @param {"signup"|"instagram_connected"|"subscription_started"|"cancellation_requested"|"subscription_canceled"|"account_deleted"|"checkout_unlinked"|"duplicate_subscription_canceled"} event
 * @param {object} payload - event-specific fields, see compose()
 * @returns {Promise<boolean>} true when the founder EMAIL was accepted by
 *   Resend. Still never throws; the boolean lets a caller with a retryable
 *   claim (the signup alert) release it on failure. SMS outcome does not
 *   affect the return value.
 */
export async function sendBusinessEventAlert(event, payload = {}) {
  try {
    const composed = compose(event, payload);
    if (!composed) {
      console.error("[business-alert] unknown event:", event);
      return false;
    }

    const emailRes = await sendEmail({
      to: FOUNDER_EMAIL,
      subject: composed.subject,
      html: `<pre>${escapeHtml(composed.body)}</pre>`,
    });

    if (FOUNDER_PHONE && SMS_EVENTS.has(event)) {
      await sendSms({ to: FOUNDER_PHONE, body: composed.subject });
    }
    return !!emailRes?.success;
  } catch (err) {
    console.error("[business-alert] send failed:", event, err?.message);
    return false;
  }
}
