import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn(async () => ({ success: true }));
const sendSms = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/notifications", () => ({ sendEmail, sendSms }));

const { sendBusinessEventAlert } = await import("./business-events");

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
