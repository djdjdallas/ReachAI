import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

/**
 * POST /api/webhooks/calendly
 *
 * Receives Calendly webhook events (invitee.created, invitee.canceled).
 * Creates/updates bookings and links them to conversations when possible.
 *
 * Setup: In Calendly → Integrations → Webhooks, add:
 *   URL: https://clinchd.io/api/webhooks/calendly
 *   Events: invitee.created, invitee.canceled
 *   Copy the signing secret into CALENDLY_WEBHOOK_SECRET env var.
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Verify webhook signature if secret is configured
    const sigHeader = request.headers.get("calendly-webhook-signature");
    if (process.env.CALENDLY_WEBHOOK_SECRET) {
      if (!verifyCalendlySignature(rawBody, sigHeader)) {
        console.error("Calendly webhook signature verification failed");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else {
      console.warn("CALENDLY_WEBHOOK_SECRET not set — skipping signature verification");
    }

    const event = body.event;
    const payload = body.payload;

    if (!event || !payload) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    if (event === "invitee.created") {
      await handleInviteeCreated(payload);
    } else if (event === "invitee.canceled") {
      await handleInviteeCanceled(payload);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Calendly webhook error:", error);
    // Always return 200 to prevent Calendly from retrying
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

/**
 * Verify Calendly webhook signature using HMAC-SHA256.
 *
 * Calendly sends: Calendly-Webhook-Signature: t=<timestamp>,v1=<signature>
 * The signed payload is: <timestamp>.<raw_body>
 */
function verifyCalendlySignature(rawBody, sigHeader) {
  if (!sigHeader) return false;

  try {
    const parts = {};
    for (const item of sigHeader.split(",")) {
      const [key, value] = item.split("=");
      parts[key.trim()] = value.trim();
    }

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;

    // Reject requests older than 5 minutes to prevent replay attacks
    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > 300) return false;

    const expected = crypto
      .createHmac("sha256", process.env.CALENDLY_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Handle invitee.created — create a booking and link to conversation if possible.
 */
async function handleInviteeCreated(payload) {
  const supabase = getSupabaseAdmin();

  const inviteeName = payload.name || payload.invitee?.name || null;
  const inviteeEmail = payload.email || payload.invitee?.email || null;
  const eventUri = payload.scheduled_event?.uri || payload.event?.uri || null;
  const eventName = payload.scheduled_event?.name || payload.event?.name || null;
  const startTime = payload.scheduled_event?.start_time || payload.event?.start_time || null;
  const endTime = payload.scheduled_event?.end_time || payload.event?.end_time || null;

  if (!startTime) {
    console.warn("Calendly invitee.created missing start_time, skipping");
    return;
  }

  // Extract the event type slug from the event URI to match against user's calendly_url
  // Calendly event URIs look like: https://api.calendly.com/scheduled_events/UUID
  // Event type URIs look like: https://api.calendly.com/event_types/UUID
  const eventTypeUri = payload.scheduled_event?.event_type
    || payload.event_type?.uri
    || null;

  // Find the Clinchd user whose calendly_url matches this event
  let user = null;
  if (eventTypeUri) {
    // Try matching by event type slug in the user's calendly_url
    const slug = extractCalendlySlug(eventTypeUri);
    if (slug) {
      const { data } = await supabase
        .from("users")
        .select("id, calendly_url")
        .ilike("calendly_url", `%${slug}%`)
        .limit(1)
        .single();
      user = data;
    }
  }

  // Fallback: try matching by invitee email against event organizer
  if (!user && payload.scheduled_event?.event_memberships) {
    for (const member of payload.scheduled_event.event_memberships) {
      const memberEmail = member.user_email;
      if (memberEmail) {
        const { data } = await supabase
          .from("users")
          .select("id, calendly_url")
          .eq("email", memberEmail)
          .single();
        if (data) {
          user = data;
          break;
        }
      }
    }
  }

  if (!user) {
    console.log("Calendly webhook: no matching user found for event", eventUri);
    return;
  }

  // Try to match a conversation by invitee name
  let conversationId = null;
  if (inviteeName) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", user.id)
      .ilike("sender_name", `%${inviteeName}%`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    conversationId = conv?.id || null;
  }

  // Upsert the booking
  const { error } = await supabase
    .from("bookings")
    .upsert(
      {
        user_id: user.id,
        conversation_id: conversationId,
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        event_name: eventName,
        start_time: startTime,
        end_time: endTime,
        calendly_event_uri: eventUri,
        status: "confirmed",
        source: "calendly",
      },
      { onConflict: "calendly_event_uri" }
    );

  if (error) {
    console.error("Failed to upsert booking:", error);
    return;
  }

  console.log(`Booking created: ${inviteeName} → ${eventName} at ${startTime}`);

  // Update conversation status to "booked" if we matched one
  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ status: "booked" })
      .eq("id", conversationId)
      .neq("status", "booked");
  }
}

/**
 * Handle invitee.canceled — mark the booking as canceled.
 */
async function handleInviteeCanceled(payload) {
  const supabase = getSupabaseAdmin();

  const eventUri = payload.scheduled_event?.uri || payload.event?.uri || null;
  if (!eventUri) {
    console.warn("Calendly invitee.canceled missing event URI, skipping");
    return;
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "canceled" })
    .eq("calendly_event_uri", eventUri);

  if (error) {
    console.error("Failed to cancel booking:", error);
    return;
  }

  console.log(`Booking canceled: ${eventUri}`);
}

/**
 * Extract a usable slug from a Calendly URI for matching.
 * Input:  "https://api.calendly.com/event_types/ABC123"
 * Output: "ABC123"
 */
function extractCalendlySlug(uri) {
  if (!uri) return null;
  const parts = uri.split("/");
  return parts[parts.length - 1] || null;
}
