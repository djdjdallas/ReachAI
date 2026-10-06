import { describe, it, expect, beforeAll, vi } from "vitest";
import { EventEmitter } from "node:events";
import { fakeDb } from "@/lib/test-utils/fake-db";
import { encrypt } from "@/lib/encryption";
import { verifySignature } from "./sign";
import { deliverClaimedEvent, isRetryable, purgeOldPayloads, reportEmitFailures, runOutboundDelivery } from "./deliver";
import { postWebhook, MAX_RESPONSE_BYTES } from "./http";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

const SECRET = "whsec_unit";
const ROW_ID = "123e4567-e89b-42d3-a456-426614174000";

function setup({ status = "processing", attempts = 1, payload = null, hook = {} } = {}) {
  return fakeDb({
    outbound_webhooks: [
      { id: "w1", user_id: "u1", url: "https://hooks.example.com/in", enabled: true, event_types: ["new_inquiry"], secret_encrypted: encrypt(SECRET), ...hook },
    ],
    outbound_webhook_events: [
      {
        id: ROW_ID,
        user_id: "u1",
        event_type: "new_inquiry",
        conversation_id: "c1",
        booking_id: null,
        data: {},
        occurred_at: "2026-10-06T10:00:00Z",
        status,
        attempts,
        claimed_at: "2026-10-06T10:00:01Z",
        payload,
        payload_purged_at: null,
      },
    ],
    users: [{ id: "u1", business_name: "Solé Aesthetics" }],
    conversations: [{ id: "c1", origin: "inbound", ai_summary: "secret summary" }],
    lead_profiles: [{ conversation_id: "c1", email: "jane@example.com", phone: null, instagram_username: "jane", treatment_interest: "botox" }],
    bookings: [],
    outbound_webhook_emit_failures: [],
  });
}
const row = (db) => db.tables.outbound_webhook_events[0];

describe("deliverClaimedEvent", () => {
  it("delivers a signed body and records metadata only", async () => {
    const db = setup();
    const sent = [];
    const post = async (req) => (sent.push(req), { ok: true, status: 200, error: null });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const outcome = await deliverClaimedEvent(db, { ...row(db) }, { post, now: () => Date.parse("2026-10-06T10:00:05Z") });
    expect(outcome).toBe("delivered");
    expect(row(db)).toMatchObject({ status: "delivered", last_status: 200, destination_host: "hooks.example.com" });
    const body = JSON.parse(sent[0].body);
    expect(body.id).toBe(`evt_${ROW_ID}`);
    expect(body.lead).toMatchObject({ id: "c1", email: "jane@example.com", treatment_interest: "botox", source: "instagram_dm" });
    expect(sent[0].body).not.toMatch(/secret summary/);
    expect(row(db).payload).toBe(sent[0].body);
    expect(
      verifySignature({
        secret: SECRET,
        timestamp: sent[0].headers["X-Clinchd-Timestamp"],
        body: sent[0].body,
        signature: sent[0].headers["X-Clinchd-Signature"],
        now: Date.parse("2026-10-06T10:00:05Z"),
      })
    ).toBe(true);
    const logged = log.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toMatch(/hooks\.example\.com/);
    expect(logged).not.toMatch(/jane@example\.com|whsec_|\/in"/);
    log.mockRestore();
  });

  it("retries resend the same bytes with a fresh timestamp and signature", async () => {
    const db = setup();
    const sent = [];
    vi.spyOn(console, "log").mockImplementation(() => {});
    let t = Date.parse("2026-10-06T10:00:05Z");
    const fail = async (req) => (sent.push(req), { ok: false, status: 503, error: null });
    expect(await deliverClaimedEvent(db, { ...row(db) }, { post: fail, now: () => t, random: () => 0.5 })).toBe("retry");
    expect(row(db)).toMatchObject({ status: "pending", last_status: 503 });
    expect(Date.parse(row(db).next_attempt_at) - t).toBe(60_000);

    // The cron claims it again a minute later.
    t += 61_000;
    Object.assign(row(db), { status: "processing", attempts: 2, claimed_at: "2026-10-06T10:01:06Z" });
    const ok = async (req) => (sent.push(req), { ok: true, status: 204, error: null });
    expect(await deliverClaimedEvent(db, { ...row(db) }, { post: ok, now: () => t })).toBe("delivered");
    expect(sent[1].body).toBe(sent[0].body);
    expect(sent[1].headers["X-Clinchd-Event-Id"]).toBe(sent[0].headers["X-Clinchd-Event-Id"]);
    expect(sent[1].headers["X-Clinchd-Timestamp"]).not.toBe(sent[0].headers["X-Clinchd-Timestamp"]);
    expect(sent[1].headers["X-Clinchd-Signature"]).not.toBe(sent[0].headers["X-Clinchd-Signature"]);
    console.log.mockRestore?.();
  });

  it("gives up after the fifth attempt", async () => {
    const db = setup({ attempts: 5 });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const outcome = await deliverClaimedEvent(db, { ...row(db) }, { post: async () => ({ ok: false, status: 500, error: null }) });
    expect(outcome).toBe("failed");
    expect(row(db)).toMatchObject({ status: "failed", last_error: "http_500" });
  });

  it("a non-retryable response fails at once", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await deliverClaimedEvent(db, { ...row(db) }, { post: async () => ({ ok: false, status: 400, error: null }) })).toBe("failed");
    expect(row(db).status).toBe("failed");
  });

  it("a blocked destination at delivery time fails without retry", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await deliverClaimedEvent(db, { ...row(db) }, { post: async () => ({ ok: false, status: null, error: "address_blocked" }) })).toBe("failed");
    expect(row(db).last_error).toBe("address_blocked");
  });

  it("a disabled webhook fails the event (replayable later)", async () => {
    const db = setup({ hook: { enabled: false } });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const post = vi.fn();
    expect(await deliverClaimedEvent(db, { ...row(db) }, { post })).toBe("failed");
    expect(post).not.toHaveBeenCalled();
    expect(row(db).last_error).toBe("webhook_disabled");
  });

  it("does not overwrite a row another run took over", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const stale = { ...row(db) };
    row(db).claimed_at = "2026-10-06T10:05:00Z"; // stale takeover happened
    expect(await deliverClaimedEvent(db, stale, { post: vi.fn() })).toBe("lost_claim");
    expect(row(db).status).toBe("processing");
  });

  it("uses the frozen payload, even if lead data changed since", async () => {
    const frozen = '{"frozen":true}';
    const db = setup({ payload: frozen });
    db.tables.lead_profiles[0].email = "changed@example.com";
    vi.spyOn(console, "log").mockImplementation(() => {});
    const sent = [];
    await deliverClaimedEvent(db, { ...row(db) }, { post: async (r) => (sent.push(r), { ok: true, status: 200 }) });
    expect(sent[0].body).toBe(frozen);
  });
});

describe("isRetryable", () => {
  it.each([
    [{ status: 500 }, true],
    [{ status: 503 }, true],
    [{ status: 429 }, true],
    [{ status: 408 }, true],
    [{ status: 400 }, false],
    [{ status: 401 }, false],
    [{ status: 404 }, false],
    [{ status: 301 }, false],
    [{ status: null, error: "timeout" }, true],
    [{ status: null, error: "econnrefused" }, true],
    [{ status: null, error: "dns_failed" }, true],
    [{ status: null, error: "address_blocked" }, false],
  ])("%j → %s", (r, expected) => {
    expect(isRetryable(r)).toBe(expected);
  });
});

describe("runOutboundDelivery", () => {
  it("claims through the RPC and reports emit failures once", async () => {
    const db = setup();
    db.tables.outbound_webhook_emit_failures.push({ id: "f1", user_id: "u1", event_type: "new_inquiry", sqlstate: "42P01", message: "x", reported_at: null, created_at: "2026-10-06T10:00:00Z" });
    db.rpc = async (name) => {
      expect(name).toBe("claim_outbound_webhook_events");
      return { data: [{ ...row(db) }], error: null };
    };
    vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const summary = await runOutboundDelivery(db, { post: async () => ({ ok: true, status: 200 }) });
    expect(summary).toMatchObject({ claimed: 1, delivered: 1, emitFailures: 1 });
    expect(err.mock.calls.join(" ")).toMatch(/emit failure/);
    expect(await reportEmitFailures(db)).toBe(0);
    err.mockRestore();
  });
});

describe("purgeOldPayloads", () => {
  it("nulls bodies 30 days after finishing and keeps metadata", async () => {
    const now = Date.parse("2026-11-10T00:00:00Z");
    const db = setup();
    Object.assign(row(db), { status: "delivered", payload: "{}", finished_at: "2026-10-06T10:00:00.000Z" });
    db.tables.outbound_webhook_events.push({ id: "e2", status: "delivered", payload: "{}", finished_at: "2026-11-01T00:00:00.000Z" });
    expect(await purgeOldPayloads(db, now)).toBe(1);
    expect(row(db)).toMatchObject({ payload: null, status: "delivered" });
    expect(row(db).payload_purged_at).toBeTruthy();
    expect(db.tables.outbound_webhook_events[1].payload).toBe("{}");
  });
});

// A stand-in for https.request: records the request, answers with the
// given status/body chunks, or never answers.
function fakeRequest({ status = 200, chunks = [], hang = false } = {}) {
  const seen = {};
  const request = (url, opts, onResponse) => {
    const req = new EventEmitter();
    seen.url = url;
    seen.opts = opts;
    req.destroy = () => req.emit("close");
    req.end = (body) => {
      seen.body = body;
      if (hang) return;
      const res = new EventEmitter();
      res.statusCode = status;
      res.destroy = () => {
        seen.destroyed = true;
        res.emit("close");
      };
      onResponse(res);
      for (const c of chunks) res.emit("data", Buffer.from(c));
      res.emit("end");
    };
    return req;
  };
  return { request, seen };
}

describe("postWebhook", () => {
  const args = { url: "https://hooks.example.com/in", body: "{}", headers: { "X-Test": "1" } };

  it("POSTs with the guarded lookup, no agent reuse, and a content length", async () => {
    const { request, seen } = fakeRequest({ status: 204 });
    expect(await postWebhook({ ...args, request })).toEqual({ ok: true, status: 204, error: null });
    expect(seen.opts.method).toBe("POST");
    expect(seen.opts.lookup.name).toBe("safeLookup");
    expect(seen.opts.agent).toBe(false);
    expect(seen.opts.headers["Content-Length"]).toBe(2);
  });

  it("refuses unsafe URLs before any request", async () => {
    const { request, seen } = fakeRequest();
    expect(await postWebhook({ ...args, url: "https://169.254.169.254/x", request })).toMatchObject({ ok: false, error: "address_blocked" });
    expect(await postWebhook({ ...args, url: "http://hooks.example.com/x", request })).toMatchObject({ ok: false, error: "https_required" });
    expect(seen.url).toBeUndefined();
  });

  it("does not follow redirects", async () => {
    const { request } = fakeRequest({ status: 302 });
    expect(await postWebhook({ ...args, request })).toEqual({ ok: false, status: 302, error: "redirect_not_followed" });
  });

  it("stops reading a large response", async () => {
    const { request, seen } = fakeRequest({ status: 200, chunks: ["x".repeat(MAX_RESPONSE_BYTES), "y".repeat(10)] });
    await postWebhook({ ...args, request });
    expect(seen.destroyed).toBe(true);
  });

  it("times out", async () => {
    const { request } = fakeRequest({ hang: true });
    expect(await postWebhook({ ...args, request, timeoutMs: 20 })).toEqual({ ok: false, status: null, error: "timeout" });
  });
});

describe("delivery: errors on our side never strand an event (audit)", () => {
  it("an event re-claimed past its last attempt is failed", async () => {
    const db = setup({ attempts: 6 });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const post = vi.fn();
    expect(await deliverClaimedEvent(db, { ...row(db) }, { post })).toBe("failed");
    expect(post).not.toHaveBeenCalled();
    expect(row(db)).toMatchObject({ status: "failed", last_error: "max_attempts" });
  });

  it("a config read error goes back on the schedule", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const failing = { ...db, from: (t) => (t === "outbound_webhooks" ? fakeDb({}, { failOn: { outbound_webhooks: { code: "57014" } } }).from(t) : db.from(t)) };
    expect(await deliverClaimedEvent(failing, { ...row(db) }, { post: vi.fn(), random: () => 0.5, now: () => 0 })).toBe("retry");
    expect(row(db)).toMatchObject({ status: "pending", last_error: "config_read_failed", next_attempt_at: new Date(60_000).toISOString() });
  });

  it("a read error while building the body retries instead of freezing an incomplete body", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    const failing = { ...db, from: (t) => (t === "lead_profiles" ? fakeDb({}, { failOn: { lead_profiles: { code: "57014" } } }).from(t) : db.from(t)) };
    const post = vi.fn();
    expect(await deliverClaimedEvent(failing, { ...row(db) }, { post, random: () => 0.5 })).toBe("retry");
    expect(post).not.toHaveBeenCalled();
    expect(row(db)).toMatchObject({ status: "pending", last_error: "envelope_read_failed", payload: null });
  });

  it("a freeze write error retries", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    let calls = 0;
    const failing = {
      ...db,
      from: (t) => {
        if (t === "outbound_webhook_events" && calls++ === 0) return fakeDb({}, { failOn: { outbound_webhook_events: { code: "40001" } } }).from(t);
        return db.from(t);
      },
    };
    expect(await deliverClaimedEvent(failing, { ...row(db) }, { post: vi.fn(), random: () => 0.5 })).toBe("retry");
    expect(row(db)).toMatchObject({ status: "pending", last_error: "freeze_failed" });
  });

  it("an unexpected throw puts the event back on the schedule", async () => {
    const db = setup();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.rpc = async () => ({ data: [{ ...row(db) }], error: null });
    const summary = await runOutboundDelivery(db, { post: async () => { throw new Error("boom"); } });
    expect(summary.retry).toBe(1);
    expect(row(db)).toMatchObject({ status: "pending", last_error: "internal_error" });
  });
});
