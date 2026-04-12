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

function alertEmail({ heading, body, ctaText, ctaUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:'Nunito',system-ui,-apple-system,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="background-color:#ff7e67;padding:32px 40px;">
  <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Clinchd</span>
</td></tr>
<tr><td style="padding:40px;">
  <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">${heading}</h1>
  <p style="margin:0 0 24px;font-size:16px;color:#44403c;line-height:1.6;">${body}</p>
  <table role="presentation" cellpadding="0" cellspacing="0">
  <tr><td style="background-color:#ff7e67;border-radius:8px;padding:14px 28px;">
    <a href="${ctaUrl}" style="color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;display:inline-block;">${ctaText}</a>
  </td></tr>
  </table>
</td></tr>
<tr><td style="padding:24px 40px;border-top:1px solid #e7e5e4;">
  <p style="margin:0;font-size:12px;color:#a8a29e;">Clinchd &middot; Automated lead alerts</p>
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
        subject: `\uD83D\uDD25 Hot Lead Alert \u2014 ${senderName} is interested`,
        html: alertEmail({
          heading: `\uD83D\uDD25 ${senderName} is a hot lead!`,
          body: `Your AI has flagged <strong>${senderName}</strong> as highly interested on Instagram. They\u2019re warm right now \u2014 check the conversation and close the deal.`,
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
        subject: `\uD83D\uDCC5 Discovery Call Booked \u2014 ${senderName} just booked`,
        html: alertEmail({
          heading: `\uD83D\uDCC5 ${senderName} booked a discovery call!`,
          body: `Great news \u2014 <strong>${senderName}</strong> just booked a discovery call through your AI. Check your calendar for the details.`,
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
