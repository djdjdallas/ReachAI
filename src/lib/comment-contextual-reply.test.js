import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

// The comment reply runs the normal reply path's pieces; the model is
// mocked, the prompt builder and linter are real.
const generateReply = vi.fn();
vi.mock("@/lib/anthropic", async (importOriginal) => ({ ...(await importOriginal()), generateReply }));
vi.mock("@/lib/reply-grounding", () => ({ loadReplyGrounding: vi.fn(async () => ({ activeOffer: null, knowledge: [] })) }));
const { generateCommentReply, commentTurn } = await import("./comment-contextual-reply");

const USER = {
  id: "u1",
  script_config: { greeting: "Hi!", offer: "Botox and fillers" },
  business_name: "Solé Aesthetics",
  assistant_name: "Katlynne",
  booking_url: "https://book.sole.example/now",
  calendly_url: "https://calendly.com/sole/consult",
  holding_text: null,
};
const CONV = { id: "conv-1", origin: "inbound" };
function setup(user = USER) {
  return fakeDb({
    users: user ? [user] : [],
    messages: [
      { id: "m2", conversation_id: "conv-1", role: "assistant", source: "agent", content: "What area are you thinking about?", created_at: "2026-10-06T10:01:00Z" },
      { id: "m1", conversation_id: "conv-1", role: "user", source: "lead", content: "hi! interested in botox", created_at: "2026-10-06T10:00:00Z" },
      { id: "mx", conversation_id: "other", role: "user", source: "lead", content: "not this thread", created_at: "2026-10-06T10:00:00Z" },
    ],
  });
}
const run = (db, extra = {}) =>
  generateCommentReply(db, { userId: "u1", conversation: CONV, caption: "Grand Opening.. Comment Botox for 10% off", commentText: "is the 10% still on?", ...extra });

beforeEach(() => generateReply.mockReset());

describe("generateCommentReply", () => {
  it("history in order, then the comment as the lead's newest turn, with the persona prompt and booking link", async () => {
    generateReply.mockResolvedValueOnce("Yes it is! Grab a spot here: https://book.sole.example/now");
    expect(await run(setup())).toEqual({ kind: "reply", text: "Yes it is! Grab a spot here: https://book.sole.example/now" });
    const [system, messages] = generateReply.mock.calls[0];
    expect(messages).toEqual([
      { role: "user", content: "hi! interested in botox", source: "lead" },
      { role: "assistant", content: "What area are you thinking about?", source: "agent" },
      { role: "user", content: 'They commented on your post (caption: "Grand Opening.. Comment Botox for 10% off"): "is the 10% still on?"' },
    ]);
    // The normal persona prompt: the clinic's assistant, its booking link.
    expect(system).toContain("Katlynne");
    expect(system).toContain("https://book.sole.example/now");
    expect(system).not.toContain("calendly.com/sole");
  });

  it("the reply is linted like every reply path (no em dashes)", async () => {
    generateReply.mockResolvedValueOnce("Yes — it's still on!");
    const r = await run(setup());
    expect(r.kind).toBe("reply");
    expect(r.text).not.toContain("—");
  });

  it("a medical handoff marker returns the holding text, never the model's words", async () => {
    generateReply.mockResolvedValueOnce("<<HANDOFF:medical_question>>");
    const r = await run(setup(), { commentText: "can I do botox while pregnant?" });
    expect(r.kind).toBe("handoff");
    expect(r.category).toBe("medical_question");
    expect(r.text).not.toMatch(/HANDOFF/);
  });

  it("the account's own holding text is used when set", async () => {
    generateReply.mockResolvedValueOnce("<<HANDOFF:missing_knowledge>>");
    const r = await run(setup({ ...USER, holding_text: "Great question, our nurse will message you shortly." }));
    expect(r).toEqual({ kind: "handoff", category: "missing_knowledge", text: "Great question, our nurse will message you shortly." });
  });

  it.each([
    ["no script", { ...USER, script_config: {} }, "no_script"],
    ["no user row", null, "user_read_failed"],
  ])("failed: %s", async (_l, user, reason) => {
    expect(await run(setup(user))).toEqual({ kind: "failed", reason });
    expect(generateReply).not.toHaveBeenCalled();
  });

  it("failed when the model throws or the reply is blocked (never throws itself)", async () => {
    generateReply.mockRejectedValueOnce(new Error("overloaded"));
    expect(await run(setup())).toEqual({ kind: "failed", reason: "generation_failed" });
    generateReply.mockResolvedValueOnce("Hi {{FIRST_NAME}}, book here");
    expect((await run(setup())).kind).toBe("failed");
  });
});

describe("commentTurn", () => {
  it("quotes the caption (trimmed to 300 chars) and the comment", () => {
    expect(commentTurn("A  caption\\nwith lines", "hi")).toBe('They commented on your post (caption: "A caption\\nwith lines"): "hi"');
    expect(commentTurn("x".repeat(400), "hi")).toContain(`"${"x".repeat(300)}"`);
    expect(commentTurn(null, "hi")).toBe('They commented on your post: "hi"');
  });
});
