import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { signBody, webhookHeaders, verifySignature, generateSecret } from "./sign";
import { nextAttemptAt, MAX_ATTEMPTS, publicEventId, rowIdFromEventId } from "./events";

const secret = "whsec_test";
const body = '{"id":"evt_1","type":"test"}';

describe("signing", () => {
  it("is hex HMAC-SHA256 of `${timestamp}.${body}` with a v1= prefix", () => {
    const expected = crypto.createHmac("sha256", secret).update(`1700000000.${body}`).digest("hex");
    expect(signBody(secret, 1700000000, body)).toBe(`v1=${expected}`);
  });

  it("headers carry event, id, unix-seconds timestamp and signature", () => {
    const h = webhookHeaders({ secret, eventId: "evt_1", eventType: "test", body, now: 1700000000123 });
    expect(h["X-Clinchd-Event"]).toBe("test");
    expect(h["X-Clinchd-Event-Id"]).toBe("evt_1");
    expect(h["X-Clinchd-Timestamp"]).toBe("1700000000");
    expect(h["X-Clinchd-Signature"]).toBe(signBody(secret, 1700000000, body));
  });

  it("a retry of the same body gets a fresh timestamp and signature", () => {
    const a = webhookHeaders({ secret, eventId: "evt_1", eventType: "test", body, now: 1700000000000 });
    const b = webhookHeaders({ secret, eventId: "evt_1", eventType: "test", body, now: 1700000060000 });
    expect(a["X-Clinchd-Event-Id"]).toBe(b["X-Clinchd-Event-Id"]);
    expect(a["X-Clinchd-Timestamp"]).not.toBe(b["X-Clinchd-Timestamp"]);
    expect(a["X-Clinchd-Signature"]).not.toBe(b["X-Clinchd-Signature"]);
  });

  it("verifies, and rejects tampering, wrong secrets and stale timestamps", () => {
    const now = 1700000000000;
    const sig = signBody(secret, 1700000000, body);
    expect(verifySignature({ secret, timestamp: "1700000000", body, signature: sig, now })).toBe(true);
    expect(verifySignature({ secret, timestamp: "1700000000", body: body + " ", signature: sig, now })).toBe(false);
    expect(verifySignature({ secret: "other", timestamp: "1700000000", body, signature: sig, now })).toBe(false);
    expect(verifySignature({ secret, timestamp: "1700000000", body, signature: sig, now: now + 301_000 })).toBe(false);
  });

  it("secrets are 32 random bytes", () => {
    const s = generateSecret();
    expect(s).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(generateSecret()).not.toBe(s);
  });
});

describe("retry schedule", () => {
  const mid = () => 0.5; // no jitter
  it("is 1m, 5m, 30m, 2h after attempts 1-4, then gives up", () => {
    const now = 0;
    expect(nextAttemptAt(1, now, mid).getTime()).toBe(60_000);
    expect(nextAttemptAt(2, now, mid).getTime()).toBe(300_000);
    expect(nextAttemptAt(3, now, mid).getTime()).toBe(1_800_000);
    expect(nextAttemptAt(4, now, mid).getTime()).toBe(7_200_000);
    expect(nextAttemptAt(MAX_ATTEMPTS, now, mid)).toBeNull();
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it("jitters within ±20%", () => {
    expect(nextAttemptAt(1, 0, () => 0).getTime()).toBe(48_000);
    expect(nextAttemptAt(1, 0, () => 1).getTime()).toBe(72_000);
  });
});

describe("event ids", () => {
  it("round-trip", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    expect(publicEventId(id)).toBe(`evt_${id}`);
    expect(rowIdFromEventId(`evt_${id}`)).toBe(id);
    expect(rowIdFromEventId("evt_nope")).toBeNull();
    expect(rowIdFromEventId(id)).toBeNull();
  });
});
