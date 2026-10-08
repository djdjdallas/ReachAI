#!/usr/bin/env node
// Sends correctly signed sample events of every type to a receiver, for
// building and testing the receiving side (docs/outbound-webhooks.md).
// Payloads come from the real envelope builder and signer, so they match
// production byte for byte in shape. Touches no database.
//
//   node --import ./scripts/_ext-loader.mjs scripts/send-sample-webhooks.mjs \
//     --url http://localhost:3000/api/ingest/clinchd --secret whsec_... [options]
//
// Options:
//   --type <event type>|all    default all (in funnel order, then test)
//   --duplicate                send each event twice (same id, fresh signature)
//   --reverse                  send in reverse order (out-of-order delivery)
//   --stale                    also send one event with a 10-minute-old
//                              timestamp (the receiver must reject it)
//   --bad-signature            also send one event with a wrong signature
//                              (the receiver must reject it)
//
// The secret can also come from CLINCHD_WEBHOOK_SECRET. Local-only tool:
// unlike production delivery it allows http:// and localhost.

import crypto from "node:crypto";
import { buildEnvelope } from "../src/lib/outbound-webhooks/payload.js";
import { EVENT_TYPES } from "../src/lib/outbound-webhooks/events.js";
import { signBody, webhookHeaders } from "../src/lib/outbound-webhooks/sign.js";

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};
const url = opt("url");
const secret = opt("secret") || process.env.CLINCHD_WEBHOOK_SECRET;
const only = opt("type") || "all";
if (!url || !secret) {
  console.error("Usage: send-sample-webhooks.mjs --url <receiver url> --secret <whsec_...> [--type t|all] [--duplicate] [--reverse] [--stale] [--bad-signature]");
  process.exit(1);
}
if (only !== "all" && !EVENT_TYPES.includes(only)) {
  console.error(`Unknown type ${only}. One of: ${EVENT_TYPES.join(", ")}`);
  process.exit(1);
}

// One demo workspace and one lead, threaded through every event.
const user = { id: "5e1f0c3a-2b7d-4c1e-9a55-0d6f3b8e2a11", business_name: "Solé Aesthetics (demo)" };
const conversationId = "8c2d4e6f-1a3b-4c5d-8e9f-0a1b2c3d4e5f";
const conversation = { id: conversationId, origin: "clinchd_sent" };
const profile = {
  instagram_username: "jane.doe.glow",
  email: "jane.doe@example.com",
  phone: "+15125550123",
  treatment_interest: "botox",
};
const booking = {
  id: "b7a1c2d3-e4f5-4a6b-8c7d-9e0f1a2b3c4d",
  start_time: new Date(Date.now() + 2 * 864e5).toISOString(),
  invitee_name: "Jane Doe",
  invitee_email: "jane.doe@example.com",
  conversation_id: conversationId,
};

const base = Date.now() - 60 * 60 * 1000;
const specs = {
  new_inquiry: { profile: { instagram_username: profile.instagram_username, treatment_interest: "botox" } },
  dm_started: { profile: { instagram_username: profile.instagram_username, treatment_interest: "botox" } },
  contact_captured: { profile },
  booking_link_sent: { profile },
  consultation_booked: { profile, booking, data: { demo: true } },
  follow_up_sent: { profile },
  handoff_requested: { profile, data: { reason: "medical_question" } },
  lead_updated: { profile: { instagram_username: profile.instagram_username, treatment_interest: "botox" } },
  test: {},
};

const types = only === "all" ? EVENT_TYPES : [only];
let events = types.map((type, i) => {
  const s = specs[type];
  const event = {
    id: crypto.randomUUID(),
    user_id: user.id,
    event_type: type,
    conversation_id: type === "test" ? null : conversationId,
    booking_id: type === "consultation_booked" ? booking.id : null,
    data: s.data || {},
    occurred_at: new Date(base + i * 5 * 60 * 1000).toISOString(),
  };
  return buildEnvelope({
    event,
    user,
    conversation: type === "test" ? null : conversation,
    profile: s.profile || null,
    booking: s.booking || null,
  });
});
if (argv.includes("--reverse")) events = events.reverse();

async function send(envelope, { stale = false, badSignature = false } = {}) {
  const body = JSON.stringify(envelope);
  const now = stale ? Date.now() - 10 * 60 * 1000 : Date.now();
  const headers = webhookHeaders({ secret, eventId: envelope.id, eventType: envelope.type, body, now });
  if (badSignature) headers["X-Clinchd-Signature"] = signBody(`${secret}x`, Math.floor(now / 1000), body);
  const label = `${envelope.type.padEnd(20)} ${envelope.id}${stale ? " (stale timestamp)" : ""}${badSignature ? " (bad signature)" : ""}`;
  try {
    const res = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
    const text = (await res.text()).slice(0, 200);
    console.log(`${res.status}  ${label}${text ? `  ${text.replace(/\s+/g, " ")}` : ""}`);
  } catch (err) {
    console.log(`ERR  ${label}  ${err.message}`);
  }
}

for (const envelope of events) {
  await send(envelope);
  if (argv.includes("--duplicate")) await send(envelope);
}
if (argv.includes("--stale")) await send(events[0], { stale: true });
if (argv.includes("--bad-signature")) await send(events[0], { badSignature: true });
