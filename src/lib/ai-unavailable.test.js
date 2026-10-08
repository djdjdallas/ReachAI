import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

const sendBusinessEventAlert = vi.fn(async () => true);
vi.mock("@/lib/alerts/business-events", () => ({ sendBusinessEventAlert }));
const { alertAiUnavailable, describeAiError, handOffDmAiUnavailable, handOffCommentAiUnavailable, ALERT_INTERVAL_MS } = await import("./ai-unavailable");

const USER = { id: "u1", email: "clinic@example.com", business_name: "Solé Aesthetics" };
const NOW = Date.parse("2026-10-08T15:31:00.000Z");
const HOOK = { id: "w1", user_id: "u1", enabled: true, event_types: ["handoff_requested"] };
beforeEach(() => sendBusinessEventAlert.mockClear());

describe("describeAiError", () => {
  it("status and Anthropic's message; plain message otherwise", () => {
    const apiErr = Object.assign(new Error("400 {...}"), { status: 400, error: { error: { message: "Your credit balance is too low to access the Anthropic API." } } });
    expect(describeAiError(apiErr)).toBe("400 Your credit balance is too low to access the Anthropic API.");
    expect(describeAiError(new Error("Request timed out."))).toBe("Request timed out.");
    expect(describeAiError(null)).toBe("unknown error");
  });
});

describe("alertAiUnavailable", () => {
  const err = Object.assign(new Error("Overloaded"), { status: 529 });
  it("emails the operator and records the alert", async () => {
    const db = fakeDb({ email_events: [] });
    expect(await alertAiUnavailable(db, { user: USER, stage: "dm_reply", error: err, now: NOW })).toEqual({ alerted: true });
    expect(sendBusinessEventAlert).toHaveBeenCalledWith("ai_unavailable", {
      email: "clinic@example.com",
      businessName: "Solé Aesthetics",
      userId: "u1",
      stage: "dm_reply",
      error: "529 Overloaded",
    });
    expect(db.tables.email_events).toEqual([
      expect.objectContaining({ user_id: "u1", event_type: "ai_unavailable_alert", metadata: { stage: "dm_reply", error: "529 Overloaded" } }),
    ]);
  });
  it("at most once per hour per account", async () => {
    const db = fakeDb({ email_events: [] });
    await alertAiUnavailable(db, { user: USER, stage: "dm_reply", error: err, now: NOW });
    expect(await alertAiUnavailable(db, { user: USER, stage: "comment_reply", error: err, now: NOW + 59 * 60_000 })).toEqual({ alerted: false });
    expect(await alertAiUnavailable(db, { user: { ...USER, id: "u2" }, stage: "dm_reply", error: err, now: NOW + 60_000 })).toEqual({ alerted: true });
    expect(await alertAiUnavailable(db, { user: USER, stage: "dm_reply", error: err, now: NOW + ALERT_INTERVAL_MS + 1000 })).toEqual({ alerted: true });
    expect(sendBusinessEventAlert).toHaveBeenCalledTimes(3);
  });
  it("never throws", async () => {
    const db = fakeDb({ email_events: [] }, { failOn: { email_events: { code: "57014" } } });
    sendBusinessEventAlert.mockRejectedValueOnce(new Error("resend down"));
    await expect(alertAiUnavailable(db, { user: USER, stage: "dm_reply", error: err, now: NOW })).resolves.toEqual({ alerted: false });
  });
});

describe("handoffs", () => {
  it("a DM: one handoff_requested (other) per thread per hour", async () => {
    const db = fakeDb({ outbound_webhooks: [HOOK], outbound_webhook_events: [] });
    await handOffDmAiUnavailable(db, { userId: "u1", conversationId: "conv-1", now: NOW });
    await handOffDmAiUnavailable(db, { userId: "u1", conversationId: "conv-1", now: NOW + 20 * 60_000 });
    await handOffDmAiUnavailable(db, { userId: "u1", conversationId: "conv-1", now: NOW + 61 * 60_000 });
    expect(db.tables.outbound_webhook_events.map((e) => [e.event_type, e.conversation_id, e.dedupe_key, e.data])).toEqual([
      ["handoff_requested", "conv-1", "handoff_requested:ai_unavailable:conv-1:2026-10-08T15", { reason: "other" }],
      ["handoff_requested", "conv-1", "handoff_requested:ai_unavailable:conv-1:2026-10-08T16", { reason: "other" }],
    ]);
  });
  it("a comment: about the commenter's thread when they have one, else a comment-only lead", async () => {
    const cid = "3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c";
    const db = fakeDb({
      outbound_webhooks: [HOOK],
      outbound_webhook_events: [],
      conversations: [{ id: "conv-9", user_id: "u1", instagram_sender_id: "known" }],
    });
    await handOffCommentAiUnavailable(db, { userId: "u1", classificationId: cid, fromId: "known", fromUsername: "jane" });
    await handOffCommentAiUnavailable(db, { userId: "u1", classificationId: "4f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c", fromId: "new", fromUsername: "kim" });
    expect(db.tables.outbound_webhook_events.map((e) => [e.conversation_id, e.data])).toEqual([
      ["conv-9", { reason: "other" }],
      [null, { reason: "other", comment_lead: { id: "4f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c", instagram_username: "kim" } }],
    ]);
  });
});
