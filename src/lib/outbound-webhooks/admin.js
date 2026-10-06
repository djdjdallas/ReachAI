// Admin operations for outbound webhooks, used by scripts/outbound-webhooks.mjs
// (run locally by Dom with the service role). There is no HTTP surface.
// Secrets are returned to the caller exactly once (create / rotate) and
// stored only encrypted.

import crypto from "crypto";
import { encrypt } from "@/lib/encryption";
import { EVENT_TYPES, LIFECYCLE_EVENT_TYPES, publicEventId, rowIdFromEventId } from "./events";
import { generateSecret } from "./sign";
import { assertSafeDestination } from "./ssrf";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A users row by id or email. Throws when not exactly one. */
export async function resolveUser(admin, ref) {
  const s = String(ref || "").trim();
  if (!s) throw new Error("--user is required (id or email)");
  const q = admin.from("users").select("id, email, full_name, business_name, billing_managed, plan, webhook_demo");
  // ilike for case-insensitivity; _ and % in an address are literal.
  const { data, error } = UUID_RE.test(s)
    ? await q.eq("id", s)
    : await q.ilike("email", s.replace(/[\\%_]/g, (c) => `\\${c}`));
  if (error) throw new Error(`user lookup failed: ${error.message}`);
  if (!data?.length) throw new Error(`no user for ${s}`);
  if (data.length > 1) throw new Error(`more than one user for ${s}`);
  return data[0];
}

/** Parse "a,b,c" into a validated lifecycle event list. */
export function parseEventTypes(value) {
  if (value == null || value === true || value === "") return [...LIFECYCLE_EVENT_TYPES];
  const list = String(value)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const bad = list.filter((t) => !EVENT_TYPES.includes(t));
  if (bad.length) throw new Error(`unknown event types: ${bad.join(", ")}`);
  return [...new Set(list)];
}

export async function getWebhook(admin, userId) {
  const { data, error } = await admin
    .from("outbound_webhooks")
    .select("id, user_id, url, enabled, event_types, created_at, updated_at, rotated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`webhook read failed: ${error.message}`);
  return data;
}

/**
 * @returns {Promise<{webhook: object, secret: string}>} secret: show once
 */
export async function createWebhook(admin, { userId, url, eventTypes, enabled = false, lookupAll }) {
  const safe = await assertSafeDestination(url, lookupAll);
  if (await getWebhook(admin, userId)) {
    throw new Error("this account already has a webhook; use set-url / rotate / enable instead");
  }
  const secret = generateSecret();
  const { data, error } = await admin
    .from("outbound_webhooks")
    .insert({
      user_id: userId,
      url: safe.toString(),
      enabled,
      event_types: eventTypes || [...LIFECYCLE_EVENT_TYPES],
      secret_encrypted: encrypt(secret),
    })
    .select("id, user_id, url, enabled, event_types, created_at")
    .single();
  if (error) throw new Error(`webhook insert failed: ${error.message}`);
  return { webhook: data, secret };
}

export async function updateWebhook(admin, userId, patch, { lookupAll } = {}) {
  const update = { updated_at: new Date().toISOString() };
  if (patch.url !== undefined) update.url = (await assertSafeDestination(patch.url, lookupAll)).toString();
  if (patch.enabled !== undefined) update.enabled = !!patch.enabled;
  if (patch.eventTypes !== undefined) update.event_types = patch.eventTypes;
  const { data, error } = await admin
    .from("outbound_webhooks")
    .update(update)
    .eq("user_id", userId)
    .select("id, user_id, url, enabled, event_types, updated_at")
    .maybeSingle();
  if (error) throw new Error(`webhook update failed: ${error.message}`);
  if (!data) throw new Error("this account has no webhook; create one first");
  return data;
}

/**
 * Replace the signing secret. Takes effect on the next attempt: events in
 * flight are signed with the new secret from then on.
 *
 * @returns {Promise<string>} the new secret: show once
 */
export async function rotateSecret(admin, userId) {
  const secret = generateSecret();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("outbound_webhooks")
    .update({ secret_encrypted: encrypt(secret), rotated_at: now, updated_at: now })
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`rotate failed: ${error.message}`);
  if (!data) throw new Error("this account has no webhook; create one first");
  return secret;
}

/** Queue a test event (lead and conversation null). @returns the public id */
export async function enqueueTestEvent(admin, userId) {
  const { data, error } = await admin
    .from("outbound_webhook_events")
    .insert({ user_id: userId, event_type: "test", dedupe_key: `test:${crypto.randomUUID()}` })
    .select("id")
    .single();
  if (error) throw new Error(`test enqueue failed: ${error.message}`);
  return publicEventId(data.id);
}

/**
 * Send an event again: same id, same body bytes (fresh timestamp and
 * signature). Not possible once the body was purged (30 days).
 */
export async function replayEvent(admin, eventId) {
  const rowId = rowIdFromEventId(eventId);
  if (!rowId) throw new Error(`not an event id: ${eventId}`);
  const { data: row, error } = await admin
    .from("outbound_webhook_events")
    .select("id, status, payload_purged_at")
    .eq("id", rowId)
    .maybeSingle();
  if (error) throw new Error(`event read failed: ${error.message}`);
  if (!row) throw new Error(`no event ${eventId}`);
  if (row.payload_purged_at) throw new Error(`${eventId} was purged (older than 30 days); it can't be replayed`);
  if (row.status === "processing") throw new Error(`${eventId} is being delivered right now`);
  const { error: upErr } = await admin
    .from("outbound_webhook_events")
    .update({
      status: "pending",
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      finished_at: null,
      last_error: null,
      last_status: null,
      claimed_at: null,
    })
    .eq("id", rowId)
    .neq("status", "processing");
  if (upErr) throw new Error(`replay failed: ${upErr.message}`);
  return publicEventId(rowId);
}

/** Recent delivery metadata (never payloads) and unreported emit failures. */
export async function webhookStatus(admin, userId, limit = 20) {
  const [events, failures] = await Promise.all([
    admin
      .from("outbound_webhook_events")
      .select("id, event_type, status, attempts, last_status, last_error, destination_host, occurred_at, next_attempt_at, finished_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("outbound_webhook_emit_failures")
      .select("event_type, sqlstate, message, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  return {
    events: (events.data || []).map((e) => ({ ...e, id: publicEventId(e.id) })),
    emitFailures: failures.data || [],
  };
}
