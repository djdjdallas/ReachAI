import { describe, it, expect } from "vitest";
import { lintReply } from "./reply-lint";

const LINK = "https://calendly.com/coach/intro";

describe("lintReply", () => {
  it.each([
    // Real prod shapes (2026-08/09 replies)
    ["Ha, fair question — yeah, I'm an AI assistant.", "Ha, fair question, yeah, I'm an AI assistant."],
    ["Haha not exactly — I'm an AI helping manage this inbox.", "Haha not exactly, I'm an AI helping manage this inbox."],
    ["What's been going on with you — anything I can help with?", "What's been going on with you, anything I can help with?"],
    ["haha fair enough—both maybe?", "haha fair enough, both maybe?"],
    ["en dash – too", "en dash, too"],
    ["trailing dash —.", "trailing dash."],
    ["most see results in 3–4 weeks", "most see results in 3-4 weeks"],
  ])("removes long dashes: %s", (input, expected) => {
    const r = lintReply(input);
    expect(r.text).toBe(expected);
    expect(r.fixes).toContain("dash");
  });

  it("never leaves a long dash in the output", () => {
    const r = lintReply("a — b — c–d — e —");
    expect(r.text).not.toMatch(/[—–]/);
  });

  it("rewrites semicolons, ellipsis characters and markdown", () => {
    const r = lintReply("yeah; that's fair… **honestly** it works");
    expect(r.text).toBe("yeah. that's fair... honestly it works");
    expect(r.fixes).toEqual(expect.arrayContaining(["semicolon", "ellipsis_char", "markdown"]));
  });

  it("strips bullet markers", () => {
    expect(lintReply("two options:\n- a call\n- email").text).toBe("two options:\na call\nemail");
  });

  it.each([
    ["Great question! It's $300 for 12 weeks.", "It's $300 for 12 weeks."],
    ["Absolutely! Here's the link.", "Here's the link."],
    ["good question, it depends on your goals", "it depends on your goals"],
  ])("drops filler openers: %s", (input, expected) => {
    expect(lintReply(input).text).toBe(expected);
  });

  it("keeps a filler opener that is the whole message", () => {
    expect(lintReply("Absolutely!").text).toBe("Absolutely!");
  });

  it("fills the booking link placeholder when a link exists", () => {
    const r = lintReply("grab a time here: {{BOOKING_LINK}}", { bookingLink: LINK });
    expect(r.text).toBe(`grab a time here: ${LINK}`);
    expect(r.blocked).toBe(false);
  });

  it("blocks leftover placeholders", () => {
    expect(lintReply("grab a time here: {{BOOKING_LINK}}").blocked).toBe(true);
    expect(lintReply("hey {{COMMENTER_NAME}}").blocked).toBe(true);
  });

  it("flags stock AI phrasing without rewriting it", () => {
    const r = lintReply("I'd be happy to help, feel free to ask our team anything");
    expect(r.text).toBe("I'd be happy to help, feel free to ask our team anything");
    expect(r.flags).toEqual(expect.arrayContaining(["i'd be happy to", "feel free to", "our team"]));
  });

  it("leaves a clean reply untouched", () => {
    const clean = "yeah that makes sense. what does your training look like right now?";
    expect(lintReply(clean)).toEqual({ text: clean, fixes: [], flags: [], blocked: false, handoff: null });
  });
});

describe("lintReply: knowledge handoff markers (fail-safe)", () => {
  it.each([
    ["<<HANDOFF:medical_question>>", "medical_question", false],
    ["<<HANDOFF:missing_knowledge>>", "missing_knowledge", false],
    ["  <<HANDOFF:missing_knowledge>>\n", "missing_knowledge", false],
    ["Good question! <<HANDOFF:medical_question>>", "medical_question", true],
    ["Totally, it's usually fine. <<HANDOFF:medical_question>> let me check", "medical_question", true],
    ["<<HANDOFF>>", "missing_knowledge", true],
    ["<<handoff: medical>>", "medical_question", true],
    ["<< HANDOFF : missing_knowledge >>", "missing_knowledge", true],
    ["HANDOFF:medical_question", "medical_question", true],
    ["medical_question", "medical_question", true],
  ])("%j is a handoff (%s), never sendable text", (raw, category, malformed) => {
    const r = lintReply(raw);
    expect(r.handoff).toEqual({ category, malformed });
    expect(r.blocked).toBe(true);
    expect(r.text).toBe("");
  });

  it.each([
    "yeah the hand off to the coach happens on the call",
    "we hand-off your plan every Monday",
    "<<not a marker>> just brackets",
  ])("ordinary text %j is not a handoff", (raw) => {
    expect(lintReply(raw).handoff).toBeNull();
  });
});
