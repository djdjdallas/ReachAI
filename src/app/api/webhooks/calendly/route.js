import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-utils";
import crypto from "crypto";

/**
 * POST /api/webhooks/calendly
 *
 * Receives Calendly webhook events (invitee.created, invitee.canceled).
 * Signing keys are per-user — we look up the owning Clinchd user from the
 * payload's scheduled_event.event_memberships[].user URI, then verify the
 * signature against that user's calendly_webhook_signing_key.
 */
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    const event = body.event;
    const payload = body.payload;

    if (!event || !payload) {
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const userUri = extractOwnerUserUri(payload);
    if (!userUri) {
      console.warn("Calendly webhook: could not extract owner user URI");
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const supabase = getSupabaseAdmin();
    const { data: owner } = await supabase
      .from("users")
      .select("id, calendly_url, calendly_webhook_signing_key")
      .eq("calendly_user_uri", userUri)
      .single();

    if (!owner) {
      console.log("Calendly webhook: no Clinchd user for", userUri);
      return NextResponse.json({ status: "ok" }, { status: 200 });
    }

    const sigHeader = request.headers.get("calendly-webhook-signature");
    const signingKey = owner.calendly_webhook_signing_key
      ? decryptToken(owner.calendly_webhook_signing_key)
      : null;

    if (!signingKey || !verifyCalendlySignature(rawBody, sigHeader, signingKey)) {
      console.error("Calendly webhook signature verification failed for", userUri);
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    if (event === "invitee.created") {
      await handleInviteeCreated(payload, owner);
    } else if (event === "invitee.canceled") {
      await handleInviteeCanceled(payload);
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    console.error("Calendly webhook error:", error);
    // Always return 200 to prevent Calendly from retrying on our bugs
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}

function extractOwnerUserUri(payload) {
  const memberships = payload.scheduled_event?.event_memberships;
  if (Array.isArray(memberships)) {
    for (const m of memberships) {
      if (m?.user) return m.user;
    }
  }
  return payload.scheduled_event?.created_by || null;
}

/**
 * Verify Calendly webhook signature using HMAC-SHA256.
 * Header format: Calendly-Webhook-Signature: t=<timestamp>,v1=<signature>
 * Signed payload: <timestamp>.<raw_body>
 */
function verifyCalendlySignature(rawBody, sigHeader, signingKey) {
  if (!sigHeader || !signingKey) return false;

  try {
    const parts = {};
    for (const item of sigHeader.split(",")) {
      const [key, value] = item.split("=");
      parts[key.trim()] = value.trim();
    }

    const timestamp = parts.t;
    const signature = parts.v1;
    if (!timestamp || !signature) return false;

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (age > 300) return false;

    const expected = crypto
      .createHmac("sha256", signingKey)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");

    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function handleInviteeCreated(payload, owner) {
  const supabase = getSupabaseAdmin();

  const inviteeName = payload.name || null;
  const inviteeEmail = payload.email || null;
  const inviteeUri = payload.uri || null;
  const eventUri = payload.scheduled_event?.uri || null;
  const eventName = payload.scheduled_event?.name || null;
  const startTime = payload.scheduled_event?.start_time || null;
  const endTime = payload.scheduled_event?.end_time || null;

  if (!startTime) {
    console.warn("Calendly invitee.created missing start_time, skipping");
    return;
  }

  let conversationId = null;
  if (inviteeName) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", owner.id)
      .ilike("sender_name", `%${inviteeName}%`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    conversationId = conv?.id || null;
  }

  const { error } = await supabase
    .from("bookings")
    .upsert(
      {
        user_id: owner.id,
        conversation_id: conversationId,
        invitee_name: inviteeName,
        invitee_email: inviteeEmail,
        event_name: eventName,
        start_time: startTime,
        end_time: endTime,
        calendly_event_uri: eventUri,
        calendly_invitee_uri: inviteeUri,
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

  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ status: "booked" })
      .eq("id", conversationId)
      .neq("status", "booked");
  }
}

async function handleInviteeCanceled(payload) {
  const supabase = getSupabaseAdmin();

  const eventUri = payload.scheduled_event?.uri || null;
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
  } else {
    console.log(`Booking canceled: ${eventUri}`);
  }
}
