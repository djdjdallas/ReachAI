import { describe, it, expect, vi, beforeEach } from "vitest";

const sendEmail = vi.fn(async () => ({ success: true }));
vi.mock("@/lib/notifications", () => ({ sendEmail }));
const { sendHandoffEmail } = await import("./handoff-email");

const user = { email: "coach@example.com" };
const conversation = { id: "conv-1", sender_name: "Ana" };
const body = () => sendEmail.mock.calls[0][0].html;

beforeEach(() => sendEmail.mockClear());

describe("sendHandoffEmail: knowledge handoffs", () => {
  it("medical: never quotes the lead's message", async () => {
    await sendHandoffEmail({
      user,
      conversation,
      reason: "medical_question",
      leadMessage: "can i get botox while breastfeeding",
      holdingSent: true,
    });
    expect(body()).not.toContain("breastfeeding");
    expect(body()).toContain("They asked a health-related question. Open the conversation to read it.");
    expect(body()).toContain("It told them you&#39;d get back to them");
  });

  it("only says the lead was told when the holding text actually sent", async () => {
    await sendHandoffEmail({ user, conversation, reason: "medical_question", leadMessage: "x", holdingSent: false });
    expect(body()).not.toContain("get back to them");
    expect(body()).toContain("The AI stopped replying, so please reply to them yourself");
  });

  it("missing knowledge keeps the excerpt and both copy variants", async () => {
    await sendHandoffEmail({
      user,
      conversation,
      reason: "missing_knowledge",
      leadMessage: "do you have weekend appointments",
      holdingSent: true,
    });
    expect(body()).toContain("do you have weekend appointments");
    expect(body()).toContain("The AI told them you&#39;d get back to them");
    sendEmail.mockClear();
    await sendHandoffEmail({ user, conversation, reason: "missing_knowledge", leadMessage: "x", holdingSent: false });
    expect(body()).not.toContain("get back to them");
  });

  it("other reasons are unchanged (excerpt included)", async () => {
    await sendHandoffEmail({ user, conversation, reason: "complex_objection", leadMessage: "can I split it with a friend" });
    expect(body()).toContain("can I split it with a friend");
  });
});
