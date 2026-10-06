// Outbox delivery. Called by /api/cron/outbound-webhooks (every minute) and
// by the admin script. Never called from a DM path.
//
// Per run: claim due events (FOR UPDATE SKIP LOCKED, stale takeover after
// 2 minutes), build and freeze each body on its first attempt, sign the
// exact bytes with a fresh timestamp, POST through the SSRF guard, then
// record delivered / retry / failed. Logs carry the event id, user id,
// destination host, type, attempts and status: never the secret, the URL
// path or the payload.

import { decrypt } from "@/lib/encryption";
import { nextAttemptAt, publicEventId } from "./events";
import { buildEnvelope } from "./payload";
import { webhookHeaders } from "./sign";
import { postWebhook } from "./http";

export const CLAIM_BATCH = 20;
export const STALE_CLAIM_SECONDS = 120;
const CONCURRENCY = 5;
export const PAYLOAD_RETENTION_DAYS = 30;

// Codes from http.js / ssrf.js that will not fix themselves.
const PERMANENT_ERRORS = new Set([
  "address_blocked",
  "https_required",
  "port_not_allowed",
  "credentials_not_allowed",
  "fragment_not_allowed",
  "url_invalid",
  "url_too_long",
  "redirect_not_followed",
]);

/** Whether a failed attempt should be retried. */
export function isRetryable({ status, error }) {
  if (status != null) return status === 408 || status === 425 || status === 429 || status >= 500;
  return !PERMANENT_ERRORS.has(error);
}

function logAttempt(fields) {
  console.log(JSON.stringify({ scope: "outbound_webhook", ...fields }));
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function loadEnvelopeInputs(admin, event) {
  const [{ data: user }, conv, profile, booking] = await Promise.all([
    admin.from("users").select("id, business_name, full_name, instagram_username").eq("id", event.user_id).maybeSingle(),
    event.conversation_id
      ? admin.from("conversations").select("id, origin").eq("id", event.conversation_id).maybeSingle()
      : { data: null },
    event.conversation_id
      ? admin
          .from("lead_profiles")
          .select("instagram_username, email, phone, treatment_interest")
          .eq("conversation_id", event.conversation_id)
          .maybeSingle()
      : { data: null },
    event.booking_id
      ? admin
          .from("bookings")
          .select("id, start_time, invitee_name, invitee_email, conversation_id")
          .eq("id", event.booking_id)
          .maybeSingle()
      : { data: null },
  ]);
  return { user, conversation: conv.data || null, profile: profile.data || null, booking: booking.data || null };
}

/**
 * Finish a claimed row. Guarded on the claim, so a run that lost its claim
 * to a stale takeover can't overwrite the newer run's result.
 */
async function finish(admin, event, patch) {
  const { error } = await admin
    .from("outbound_webhook_events")
    .update(patch)
    .eq("id", event.id)
    .eq("status", "processing")
    .eq("claimed_at", event.claimed_at);
  if (error) console.error("[outbound-webhooks] finish failed:", { event_id: publicEventId(event.id), code: error.code });
}

/**
 * Deliver one claimed event (status 'processing', attempts already counted).
 *
 * @returns {Promise<'delivered'|'retry'|'failed'|'lost_claim'>}
 */
export async function deliverClaimedEvent(admin, event, { post = postWebhook, now = () => Date.now(), random } = {}) {
  const eventId = publicEventId(event.id);
  const base = { event_id: eventId, user_id: event.user_id, type: event.event_type, attempts: event.attempts };
  const failNow = async (error, host = null) => {
    await finish(admin, event, {
      status: "failed",
      last_error: error,
      last_status: null,
      finished_at: new Date(now()).toISOString(),
      ...(host ? { destination_host: host } : {}),
    });
    logAttempt({ ...base, host, outcome: "failed", error });
    return "failed";
  };

  const { data: hook, error: hookErr } = await admin
    .from("outbound_webhooks")
    .select("id, url, enabled, event_types, secret_encrypted")
    .eq("user_id", event.user_id)
    .maybeSingle();
  if (hookErr) {
    // Transient read error: leave the claim; the stale takeover retries it.
    logAttempt({ ...base, outcome: "retry", error: "config_read_failed" });
    return "retry";
  }
  if (!hook) return failNow("webhook_missing");
  if (!hook.enabled) return failNow("webhook_disabled", hostOf(hook.url));
  const host = hostOf(hook.url);

  let secret;
  try {
    secret = decrypt(hook.secret_encrypted);
  } catch {
    return failNow("secret_unreadable", host);
  }

  // Freeze the body on the first attempt; every retry and replay sends
  // these same bytes.
  let body = event.payload;
  if (!body) {
    if (event.payload_purged_at) return failNow("payload_purged", host);
    const inputs = await loadEnvelopeInputs(admin, event);
    body = JSON.stringify(buildEnvelope({ event, ...inputs }));
    const { data: frozen, error: freezeErr } = await admin
      .from("outbound_webhook_events")
      .update({ payload: body })
      .eq("id", event.id)
      .eq("status", "processing")
      .eq("claimed_at", event.claimed_at)
      .is("payload", null)
      .select("id");
    if (freezeErr || !frozen?.length) {
      logAttempt({ ...base, host, outcome: "lost_claim" });
      return "lost_claim";
    }
  }

  const headers = webhookHeaders({ secret, eventId, eventType: event.event_type, body, now: now() });
  const result = await post({ url: hook.url, body, headers });
  const at = new Date(now()).toISOString();

  if (result.ok) {
    await finish(admin, event, {
      status: "delivered",
      last_status: result.status,
      last_error: null,
      destination_host: host,
      finished_at: at,
    });
    logAttempt({ ...base, host, outcome: "delivered", status: result.status });
    return "delivered";
  }

  const next = isRetryable(result) ? nextAttemptAt(event.attempts, now(), random) : null;
  if (!next) {
    await finish(admin, event, {
      status: "failed",
      last_status: result.status,
      last_error: result.error || `http_${result.status}`,
      destination_host: host,
      finished_at: at,
    });
    logAttempt({ ...base, host, outcome: "failed", status: result.status, error: result.error });
    return "failed";
  }
  await finish(admin, event, {
    status: "pending",
    next_attempt_at: next.toISOString(),
    last_status: result.status,
    last_error: result.error || `http_${result.status}`,
    destination_host: host,
  });
  logAttempt({ ...base, host, outcome: "retry", status: result.status, error: result.error, next_attempt_at: next.toISOString() });
  return "retry";
}

/**
 * Log emit failures the triggers recorded (each once), so a broken emit
 * shows up in the cron logs instead of only as a Postgres WARNING.
 */
export async function reportEmitFailures(admin) {
  const { data, error } = await admin
    .from("outbound_webhook_emit_failures")
    .select("id, user_id, event_type, sqlstate, message, created_at")
    .is("reported_at", null)
    .order("created_at", { ascending: true })
    .limit(50);
  if (error || !data?.length) return 0;
  for (const f of data) {
    console.error(
      "[outbound-webhooks] emit failure:",
      JSON.stringify({ user_id: f.user_id, type: f.event_type, sqlstate: f.sqlstate, message: f.message, at: f.created_at })
    );
  }
  await admin
    .from("outbound_webhook_emit_failures")
    .update({ reported_at: new Date().toISOString() })
    .in(
      "id",
      data.map((f) => f.id)
    );
  return data.length;
}

/**
 * Null out bodies 30 days after delivered/failed; keep the metadata. Also
 * drops reported emit-failure rows older than 30 days.
 */
export async function purgeOldPayloads(admin, now = Date.now()) {
  const cutoff = new Date(now - PAYLOAD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("outbound_webhook_events")
    .update({ payload: null, payload_purged_at: new Date(now).toISOString() })
    .in("status", ["delivered", "failed"])
    .not("payload", "is", null)
    .lt("finished_at", cutoff)
    .select("id");
  if (error) console.error("[outbound-webhooks] payload purge failed:", error.code);
  await admin.from("outbound_webhook_emit_failures").delete().not("reported_at", "is", null).lt("created_at", cutoff);
  return data?.length || 0;
}

/**
 * One cron run.
 *
 * @returns {Promise<{claimed: number, delivered: number, retry: number, failed: number, emitFailures: number, purged: number}>}
 */
export async function runOutboundDelivery(admin, { now = Date.now(), purge = false, post } = {}) {
  const summary = { claimed: 0, delivered: 0, retry: 0, failed: 0, emitFailures: 0, purged: 0 };

  const { data: claimed, error } = await admin.rpc("claim_outbound_webhook_events", {
    p_batch: CLAIM_BATCH,
    p_stale_seconds: STALE_CLAIM_SECONDS,
  });
  if (error) {
    console.error("[outbound-webhooks] claim failed:", error.code || error.message);
  } else {
    const rows = claimed || [];
    summary.claimed = rows.length;
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const outcomes = await Promise.all(
        rows.slice(i, i + CONCURRENCY).map((row) =>
          deliverClaimedEvent(admin, row, post ? { post } : {}).catch((err) => {
            console.error("[outbound-webhooks] deliver threw:", { event_id: publicEventId(row.id), error: err?.message });
            return "retry";
          })
        )
      );
      for (const o of outcomes) if (o in summary) summary[o] += 1;
    }
  }

  summary.emitFailures = await reportEmitFailures(admin).catch(() => 0);
  if (purge) summary.purged = await purgeOldPayloads(admin, now).catch(() => 0);
  return summary;
}

