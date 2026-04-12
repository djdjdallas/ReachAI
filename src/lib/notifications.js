import { Resend } from "resend";
import twilio from "twilio";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://clinchd.io";

// --------------- lazy singletons ---------------

let _resend;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

let _twilio;
function getTwilio() {
  if (!_twilio)
    _twilio = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  return _twilio;
}

// --------------- low-level helpers ---------------

/**
 * Send an email via Resend. Never throws.
 */
export async function sendEmail({ to, subject, html }) {
  try {
    const { data, error } = await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Clinchd <notifications@clinchd.io>",
      to,
      subject,
      html,
    });
    if (error) {
      console.error("Resend error:", error);
      return { success: false, error };
    }
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error("sendEmail failed:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send an SMS via Twilio. Never throws.
 * `to` should be E.164 format — we normalise just in case.
 */
export async function sendSms({ to, body }) {
  try {
    // Basic E.164 normalisation
    let phone = to.replace(/[^\d+]/g, "");
    if (!phone.startsWith("+")) {
      phone = phone.length === 10 ? `+1${phone}` : `+${phone}`;
    }

    const message = await getTwilio().messages.create({
      body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    return { success: true, sid: message.sid };
  } catch (err) {
    console.error("sendSms failed:", err.message);
    return { success: false, error: err.message };
  }
}

// --------------- deduplication helper ---------------

async function alreadySent(supabase, userId, eventType, conversationId) {
  const query = supabase
    .from("email_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", eventType);

  if (conversationId) {
    query.eq("metadata->>conversation_id", conversationId);
  }

  const { data } = await query.limit(1).maybeSingle();
  return !!data;
}

async function logEvent(supabase, userId, eventType, metadata = {}) {
  await supabase.from("email_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata,
  });
}

// --------------- branded email template ---------------

function alertEmail({ badge, heading, body, ctaText, ctaUrl }) {
  const logoUrl = `${APP_URL}/logo.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<style>@import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@700,800&f[]=satoshi@400,500,700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#fafaf9;font-family:'Satoshi',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafaf9;">
<tr><td align="center" style="padding:48px 16px 40px;">

<!-- Card -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e7e5e4;">

<!-- Header -->
<tr><td style="padding:36px 40px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle;padding-right:10px;">
      <img src="${logoUrl}" alt="Clinchd" width="36" height="36" style="display:block;border-radius:8px;" />
    </td>
    <td style="vertical-align:middle;">
      <span style="font-family:'Cabinet Grotesk','Satoshi',system-ui,sans-serif;font-size:20px;font-weight:800;color:#1c1917;letter-spacing:-0.02em;">Clinchd</span>
    </td>
  </tr></table>
</td></tr>

<!-- Body -->
<tr><td style="padding:32px 40px 40px;">
  <!-- Badge -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:24px;"><tr>
    <td style="background-color:#fff5f2;border:1px solid rgba(255,126,103,0.1);border-radius:999px;padding:6px 14px;">
      <span style="font-size:13px;font-weight:700;color:#ff7e67;letter-spacing:-0.01em;">${badge}</span>
    </td>
  </tr></table>

  <h1 style="margin:0 0 16px;font-family:'Cabinet Grotesk','Satoshi',system-ui,sans-serif;font-size:28px;font-weight:800;color:#1c1917;letter-spacing:-0.02em;line-height:1.15;">${heading}</h1>

  <p style="margin:0 0 32px;font-size:16px;color:#78716c;line-height:1.7;font-weight:500;">${body}</p>

  <!-- CTA Button -->
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="background-color:#ff7e67;border-radius:999px;padding:16px 32px;box-shadow:0 8px 24px rgba(255,126,103,0.3);">
      <a href="${ctaUrl}" style="color:#ffffff;font-family:'Satoshi',system-ui,sans-serif;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;">${ctaText} &rarr;</a>
    </td>
  </tr></table>
</td></tr>

<!-- Footer -->
<tr><td style="padding:24px 40px;background-color:#f5f5f4;border-top:1px solid #e7e5e4;">
  <p style="margin:0;font-size:12px;color:#a8a29e;line-height:1.5;">
    Clinchd &middot; AI DM automation for coaches<br/>
    <a href="${APP_URL}/settings" style="color:#a8a29e;text-decoration:underline;">Notification settings</a>
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

// --------------- high-level alert functions ---------------

/**
 * Alert user about a hot lead (status → interested).
 * Fire-and-forget — never throws.
 */
export async function sendHotLeadAlert(user, conversation) {
  try {
    if (!user.notify_hot_leads_email && !user.notify_hot_leads_sms) return;

    const supabase = getSupabaseAdmin();
    if (await alreadySent(supabase, user.id, "hot_lead_alert", conversation.id))
      return;

    const senderName = conversation.sender_name || "New Lead";
    const conversationUrl = `${APP_URL}/conversations?thread=${conversation.id}`;

    // Send email
    if (user.notify_hot_leads_email && user.email) {
      await sendEmail({
        to: user.email,
        subject: `Hot Lead Alert \u2014 ${senderName} is interested`,
        html: alertEmail({
          badge: "\uD83D\uDD25 Hot Lead",
          heading: `${senderName} is interested`,
          body: `Your AI has flagged <strong style="color:#1c1917;">${senderName}</strong> as highly interested on Instagram. They\u2019re warm right now \u2014 check the conversation and close the deal.`,
          ctaText: "View Conversation",
          ctaUrl: conversationUrl,
        }),
      });
    }

    // Send SMS
    if (user.notify_hot_leads_sms && user.phone_number) {
      await sendSms({
        to: user.phone_number,
        body: `\uD83D\uDD25 Clinchd Alert: ${senderName} is a hot lead on Instagram. View now: ${conversationUrl}`,
      });
    }

    await logEvent(supabase, user.id, "hot_lead_alert", {
      conversation_id: conversation.id,
    });
  } catch (err) {
    console.error("sendHotLeadAlert failed:", err.message);
  }
}

/**
 * Alert user about a booked discovery call (status → booked).
 * Fire-and-forget — never throws.
 */
export async function sendBookingAlert(user, conversation) {
  try {
    if (!user.notify_bookings_email && !user.notify_bookings_sms) return;

    const supabase = getSupabaseAdmin();
    if (
      await alreadySent(supabase, user.id, "booking_alert", conversation.id)
    )
      return;

    const senderName = conversation.sender_name || "A lead";
    const calendarUrl = `${APP_URL}/calendar`;

    // Send email
    if (user.notify_bookings_email && user.email) {
      await sendEmail({
        to: user.email,
        subject: `Discovery Call Booked \u2014 ${senderName} just booked`,
        html: alertEmail({
          badge: "\uD83D\uDCC5 Call Booked",
          heading: `${senderName} booked a discovery call`,
          body: `Great news \u2014 <strong style="color:#1c1917;">${senderName}</strong> just booked a discovery call through your AI. Check your calendar for the details.`,
          ctaText: "View Calendar",
          ctaUrl: calendarUrl,
        }),
      });
    }

    // Send SMS
    if (user.notify_bookings_sms && user.phone_number) {
      await sendSms({
        to: user.phone_number,
        body: `\uD83D\uDCC5 Clinchd: ${senderName} just booked a discovery call! Check your calendar: ${calendarUrl}`,
      });
    }

    await logEvent(supabase, user.id, "booking_alert", {
      conversation_id: conversation.id,
    });
  } catch (err) {
    console.error("sendBookingAlert failed:", err.message);
  }
}
