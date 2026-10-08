import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn(async () => ({ success: true }));
const sendSms = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/notifications", () => ({ sendEmail, sendSms }));

const { sendBusinessEventAlert, accountAgeHours } = await import("./business-events");

describe("cancellation_requested alert", () => {
  beforeEach(() => {
    sendEmail.mockClear();
  });

  it("includes email, instagram, plan, end date and the customer's comment", async () => {
    const ok = await sendBusinessEventAlert("cancellation_requested", {
      email: "coach@example.com",
      instagramUsername: "coachig",
      plan: "unlimited",
      cancelAt: "2026-10-26T04:08:43.000Z",
      canceledAt: "2026-09-26T15:47:37.000Z",
      reason: "other",
      comment: "It doesn't have what I'm looking for",
      stripeCustomerId: "cus_test",
    });
    expect(ok).toBe(true);
    const { subject, html } = sendEmail.mock.calls[0][0];
    expect(subject).toContain("cancel requested: coach@example.com (@coachig), unlimited, ends 2026-10-26");
    for (const line of [
      "instagram: @coachig",
      "plan: unlimited",
      "access ends: 2026-10-26T04:08:43.000Z",
      "reason: other",
      "comment: It doesn&#39;t have what I&#39;m looking for",
    ]) {
      expect(html).toContain(line);
    }
    expect(subject + html).not.toMatch(/[–—]/);
  });

  it("degrades gracefully with missing fields", async () => {
    await sendBusinessEventAlert("cancellation_requested", {});
    const { html } = sendEmail.mock.calls[0][0];
    expect(html).toContain("instagram: unknown");
    expect(html).toContain("comment: none");
  });
});

describe("account_deleted alert", () => {
  beforeEach(() => {
    sendEmail.mockClear();
  });

  it("carries email, instagram, plan, status, created and age", async () => {
    await sendBusinessEventAlert("account_deleted", {
      email: "coach@example.com",
      instagramUsername: "coachig",
      plan: "base",
      subscriptionStatus: "trialing",
      createdAt: "2026-09-24T03:10:56.000Z",
      accountAgeHours: 27.3,
    });
    const { subject, html } = sendEmail.mock.calls[0][0];
    expect(subject).toBe("[clinchd] account deleted: coach@example.com (@coachig), base/trialing, 27.3h old");
    for (const line of [
      "instagram: @coachig",
      "plan: base",
      "subscription status: trialing",
      "created: 2026-09-24T03:10:56.000Z",
      "account age: 27.3h",
    ]) {
      expect(html).toContain(line);
    }
    expect(subject + html).not.toMatch(/[–—]/);
  });

  it("degrades gracefully with missing fields", async () => {
    await sendBusinessEventAlert("account_deleted", {});
    const { subject } = sendEmail.mock.calls[0][0];
    expect(subject).toContain("unknown email");
    expect(subject).toContain("unknown old");
  });
});

describe("accountAgeHours", () => {
  const created = "2026-09-24T03:10:56Z";
  it("one decimal under a day", () => {
    expect(accountAgeHours(created, Date.parse("2026-09-24T10:28:00Z"))).toBe(7.3);
  });
  it("whole hours from a day on", () => {
    expect(accountAgeHours(created, Date.parse("2026-09-26T03:40:00Z"))).toBe(48);
  });
  it("null without a created date", () => {
    expect(accountAgeHours(null)).toBeNull();
  });
});

describe("ai_unavailable alert", () => {
  beforeEach(() => {
    sendEmail.mockClear();
    sendSms.mockClear();
  });

  it("names the account, where it failed and the error; email only", async () => {
    const ok = await sendBusinessEventAlert("ai_unavailable", {
      email: "clinic@example.com",
      businessName: "Solé Aesthetics",
      userId: "e1f2fb2c-1487-49fa-bb30-9bb8706f0281",
      stage: "comment_classification",
      error: "400 Your credit balance is too low to access the Anthropic API.",
    });
    expect(ok).toBe(true);
    const { subject, html } = sendEmail.mock.calls[0][0];
    expect(subject).toBe("[clinchd] ⚠️ AI unavailable: Solé Aesthetics");
    for (const line of [
      "account: Solé Aesthetics (clinic@example.com)",
      "user id: e1f2fb2c-1487-49fa-bb30-9bb8706f0281",
      "failed at: comment_classification",
      "error: 400 Your credit balance is too low to access the Anthropic API.",
      "Nothing is being sent to leads.",
    ]) {
      expect(html).toContain(line);
    }
    expect(sendSms).not.toHaveBeenCalled();
  });
});
