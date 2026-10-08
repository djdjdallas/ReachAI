import { describe, it, expect, beforeAll } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";
import { decrypt } from "@/lib/encryption";
import { createWebhook, enqueueTestEvent, parseEventTypes, replayEvent, rotateSecret, updateWebhook, resolveUser } from "./admin";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "b".repeat(64);
});

const publicDns = async () => [{ address: "93.184.216.34", family: 4 }];
const privateDns = async () => [{ address: "10.0.0.7", family: 4 }];
const ROW = "123e4567-e89b-42d3-a456-426614174000";

describe("admin", () => {
  it("parseEventTypes defaults to every lifecycle event and rejects unknown types", () => {
    expect(parseEventTypes(undefined)).toHaveLength(8);
    expect(parseEventTypes(undefined)).toContain("lead_updated");
    expect(parseEventTypes("dm_started, handoff_requested")).toEqual(["dm_started", "handoff_requested"]);
    expect(() => parseEventTypes("dm_started,lead_deleted")).toThrow(/lead_deleted/);
  });

  it("create stores only the encrypted secret and returns it once", async () => {
    const db = fakeDb({ outbound_webhooks: [] }, { unique: { outbound_webhooks: "user_id" } });
    const { webhook, secret } = await createWebhook(db, { userId: "u1", url: "https://app.mararue.com/api/ingest/clinchd", lookupAll: publicDns });
    expect(secret).toMatch(/^whsec_/);
    const stored = db.tables.outbound_webhooks[0];
    expect(stored.secret_encrypted).not.toContain(secret);
    expect(decrypt(stored.secret_encrypted)).toBe(secret);
    expect(webhook).not.toHaveProperty("secret_encrypted");
    expect(stored.enabled).toBe(false);
  });

  it("create and set-url run the SSRF guard (DNS included)", async () => {
    const db = fakeDb({ outbound_webhooks: [] });
    await expect(createWebhook(db, { userId: "u1", url: "https://internal.example.com/x", lookupAll: privateDns })).rejects.toMatchObject({ code: "address_blocked" });
    await expect(createWebhook(db, { userId: "u1", url: "http://app.mararue.com/x", lookupAll: publicDns })).rejects.toMatchObject({ code: "https_required" });
    db.tables.outbound_webhooks.push({ id: "w1", user_id: "u1", url: "https://a.example.com", enabled: true });
    await expect(updateWebhook(db, "u1", { url: "https://169.254.169.254/x" })).rejects.toMatchObject({ code: "address_blocked" });
  });

  it("rotate replaces the secret", async () => {
    const db = fakeDb({ outbound_webhooks: [{ id: "w1", user_id: "u1", secret_encrypted: "old" }] });
    const secret = await rotateSecret(db, "u1");
    expect(decrypt(db.tables.outbound_webhooks[0].secret_encrypted)).toBe(secret);
    expect(db.tables.outbound_webhooks[0].rotated_at).toBeTruthy();
  });

  it("test events are queued with a unique key", async () => {
    const db = fakeDb({ outbound_webhook_events: [] });
    const a = await enqueueTestEvent(db, "u1");
    const b = await enqueueTestEvent(db, "u1");
    expect(a).toMatch(/^evt_/);
    expect(a).not.toBe(b);
    expect(db.tables.outbound_webhook_events.map((e) => e.event_type)).toEqual(["test", "test"]);
  });

  it("replay resets the schedule but keeps the id and body; refuses purged events", async () => {
    const db = fakeDb({ outbound_webhook_events: [{ id: ROW, status: "failed", attempts: 5, payload: "{}", payload_purged_at: null, finished_at: "x" }] });
    expect(await replayEvent(db, `evt_${ROW}`)).toBe(`evt_${ROW}`);
    expect(db.tables.outbound_webhook_events[0]).toMatchObject({ status: "pending", attempts: 0, payload: "{}", finished_at: null });
    db.tables.outbound_webhook_events[0].payload_purged_at = "y";
    await expect(replayEvent(db, `evt_${ROW}`)).rejects.toThrow(/purged/);
    await expect(replayEvent(db, "evt_bad")).rejects.toThrow(/not an event id/);
  });

  it("resolveUser needs exactly one match", async () => {
    const db = fakeDb({ users: [{ id: "123e4567-e89b-42d3-a456-426614174999", email: "a@example.com" }] });
    expect((await resolveUser(db, "A@example.com")).email).toBe("a@example.com");
    await expect(resolveUser(db, "nobody@example.com")).rejects.toThrow(/no user/);
  });
});
