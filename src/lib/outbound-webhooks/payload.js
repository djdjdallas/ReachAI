// Builds the outbound webhook envelope (contract version "1",
// docs/outbound-webhooks.md). Pure: the deliverer loads the rows and freezes
// the returned JSON as the event's body on the first attempt.
//
// Allowlist only. Every field is built from validated columns:
//   - lead contact fields come from lead_profiles (already validated) or a
//     Calendly booking, re-validated here
//   - treatment_interest is a category key, never lead text
//   - data carries only the documented keys per type
// Message text, transcripts, medical details, images and free text never
// enter the envelope. Fields we don't have are omitted (omitted = unchanged
// for the receiver).

import { CONTRACT_VERSION, HANDOFF_REASONS, publicEventId } from "./events";
import { extractEmail, normalizePhone, validUsername } from "./lead-capture";

const CATEGORY_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const NAME_PART_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]{0,59}$/u;

function cleanName(part) {
  const s = typeof part === "string" ? part.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  return NAME_PART_RE.test(s) ? s : null;
}

/** "Jane Q. Doe" → {first: "Jane", last: "Q. Doe"}; one word → first only. */
export function splitName(full) {
  const s = typeof full === "string" ? full.replace(/\s+/g, " ").trim() : "";
  if (!s) return { first: null, last: null };
  const i = s.indexOf(" ");
  if (i === -1) return { first: cleanName(s), last: null };
  return { first: cleanName(s.slice(0, i)), last: cleanName(s.slice(i + 1)) };
}

function cleanEmail(e) {
  return typeof e === "string" && extractEmail(e) === e.trim().toLowerCase() ? e.trim().toLowerCase() : null;
}

function cleanPhone(p) {
  return typeof p === "string" && /^\+[1-9]\d{7,14}$/.test(p) && normalizePhone(p) === p ? p : null;
}

function iso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function workspaceName(user) {
  const candidates = [user?.business_name, user?.full_name, user?.instagram_username ? `@${user.instagram_username}` : null];
  for (const c of candidates) {
    const s = typeof c === "string" ? c.replace(/[\p{Cc}]/gu, "").trim() : "";
    if (s) return s.slice(0, 120);
  }
  return null;
}

const leadSourceFor = (origin) => (origin === "clinchd_sent" ? "instagram_comment" : "instagram_dm");
const triggerTypeFor = (origin) => (origin === "clinchd_sent" ? "comment" : "dm");

/**
 * @param {object} args
 * @param {object} args.event - outbound_webhook_events row
 * @param {object} args.user - users row (id, business_name, full_name, instagram_username)
 * @param {object|null} args.conversation - conversations row (id, origin) or null (deleted, or none)
 * @param {object|null} args.profile - lead_profiles row or null
 * @param {object|null} args.booking - bookings row (consultation_booked) or null
 * @returns {object} the envelope
 */
export function buildEnvelope({ event, user, conversation, profile, booking }) {
  const type = event.event_type;
  const envelope = {
    id: publicEventId(event.id),
    type,
    version: CONTRACT_VERSION,
    occurred_at: iso(event.occurred_at) || new Date().toISOString(),
    workspace: { id: user?.id || event.user_id, name: workspaceName(user) },
    lead: null,
    conversation: null,
    data: {},
  };

  if (type === "test") return envelope;

  const conversationId = event.conversation_id || null;
  // A Calendly booking that matched no conversation is a booking-only lead.
  const bookingOnly = type === "consultation_booked" && !conversationId && booking?.id;
  const leadId = conversationId || (bookingOnly ? `bkg_${booking.id}` : null);

  if (leadId) {
    const lead = { id: leadId };
    const username = validUsername(profile?.instagram_username);
    if (username) lead.instagram_username = username;

    // The invitee's name and email are attached only when the booking is
    // known to be this lead's: matched on the email the lead typed in the
    // DMs, or a booking-only lead (the invitee IS the lead). A conversation
    // matched by name gets neither: if that match is wrong they would attach
    // to the wrong person.
    const inviteeEmail = booking ? cleanEmail(booking.invitee_email) : null;
    const matchedByEmail = Boolean(inviteeEmail) && cleanEmail(profile?.email) === inviteeEmail;
    if (type === "consultation_booked" && booking && (bookingOnly || matchedByEmail)) {
      const { first, last } = splitName(booking.invitee_name);
      if (first) lead.first_name = first;
      if (last) lead.last_name = last;
    }

    const email = cleanEmail(profile?.email) || (bookingOnly ? inviteeEmail : null);
    if (email) lead.email = email;
    const phone = cleanPhone(profile?.phone);
    if (phone) lead.phone = phone;
    const treatment = typeof profile?.treatment_interest === "string" ? profile.treatment_interest : null;
    if (treatment && CATEGORY_KEY_RE.test(treatment)) lead.treatment_interest = treatment;
    if (conversation?.origin) lead.source = leadSourceFor(conversation.origin);
    envelope.lead = lead;
  }

  if (conversationId) {
    envelope.conversation = {
      id: conversationId,
      trigger: null,
      trigger_type: conversation?.origin ? triggerTypeFor(conversation.origin) : null,
    };
  }

  if (type === "handoff_requested") {
    const reason = event.data?.reason;
    envelope.data = { reason: HANDOFF_REASONS.includes(reason) ? reason : "other" };
  } else if (type === "consultation_booked") {
    envelope.data = { scheduled_for: iso(booking?.start_time) };
    if (event.data?.demo === true) envelope.data.demo = true;
  }

  return envelope;
}
