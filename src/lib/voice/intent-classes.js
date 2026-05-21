// Leaf module — no imports, safe for client and server. Holds the
// intent-class constants shared between the classifier (server-side),
// the API routes (server-side), and the dashboard UI (client-side).
//
// Why this file exists: src/lib/dm-intent.js pulls in the Anthropic SDK,
// which is Node-only. Importing class lists from there into a 'use client'
// component drags Node deps into the browser bundle. This module is the
// shared boundary.

/**
 * Every intent class the DM classifier can return. Keep in sync with the
 * `class` enum in src/lib/dm-intent.js's RECORD_DM_INTENT_TOOL.
 */
export const DM_INTENT_CLASSES = [
  "warm_intent",
  "objection_price",
  "objection_time",
  "objection_trust",
  "booking_cta",
  "follow_up",
  "do_not_send",
];

/**
 * The 6 intent classes a coach can upload voice memos for. Same as
 * DM_INTENT_CLASSES minus 'do_not_send' (we never voice-reply to
 * hostile messages). Single source of truth for API validation + UI
 * dropdowns.
 */
export const VOICE_ELIGIBLE_CLASSES = [
  "warm_intent",
  "objection_price",
  "objection_time",
  "objection_trust",
  "booking_cta",
  "follow_up",
];

/**
 * Display labels for the 6 voice-eligible classes. Used in the dashboard
 * dropdown + coverage strip.
 */
export const VOICE_INTENT_LABELS = {
  warm_intent: "Warm intent (interested, asking questions)",
  objection_price: "Price objection",
  objection_time: "Time / scheduling objection",
  objection_trust: "Trust / proof objection",
  booking_cta: "Booking CTA (sending calendar link)",
  follow_up: "Follow-up nudge",
};
