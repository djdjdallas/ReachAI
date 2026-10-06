// Signing for outbound webhooks. The receiver recomputes
//   hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`))
// over the exact bytes it received. Every attempt (including retries of the
// same event id) gets a fresh timestamp and signature over the same body.

import crypto from "crypto";

export const SIGNATURE_VERSION = "v1";

/**
 * @param {string} secret
 * @param {number} timestamp - unix seconds
 * @param {string} body - the exact body string that will be sent
 * @returns {string} "v1=<hex>"
 */
export function signBody(secret, timestamp, body) {
  const hex = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");
  return `${SIGNATURE_VERSION}=${hex}`;
}

/**
 * Headers for one attempt.
 *
 * @param {{secret: string, eventId: string, eventType: string, body: string, now?: number}} args
 * @returns {Record<string, string>}
 */
export function webhookHeaders({ secret, eventId, eventType, body, now = Date.now() }) {
  const timestamp = Math.floor(now / 1000);
  return {
    "Content-Type": "application/json",
    "User-Agent": "Clinchd-Webhooks/1",
    "X-Clinchd-Event": eventType,
    "X-Clinchd-Event-Id": eventId,
    "X-Clinchd-Timestamp": String(timestamp),
    "X-Clinchd-Signature": signBody(secret, timestamp, body),
  };
}

/**
 * Receiver-side check (used by tests and the docs example): constant-time
 * compare, 5-minute timestamp tolerance.
 *
 * @returns {boolean}
 */
export function verifySignature({ secret, timestamp, body, signature, now = Date.now(), toleranceSec = 300 }) {
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(Math.floor(now / 1000) - ts) > toleranceSec) return false;
  const expected = Buffer.from(signBody(secret, ts, body));
  const got = Buffer.from(String(signature || ""));
  return expected.length === got.length && crypto.timingSafeEqual(expected, got);
}

/** A new signing secret: "whsec_" + 32 random bytes, hex. */
export function generateSecret() {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}
