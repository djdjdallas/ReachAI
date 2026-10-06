import { describe, it, expect } from "vitest";
import {
  HANDOFF_HOLDING_TEXT,
  HANDOFF_MARKERS,
  holdingTextFor,
  detectHandoff,
} from "./handoff-reply";
import { lintReply } from "./reply-lint";

describe("holding text", () => {
  it("is the approved wording", () => {
    expect(HANDOFF_HOLDING_TEXT).toBe("Good question, let me check on that and get back to you.");
    expect(holdingTextFor({ id: "any" })).toBe(HANDOFF_HOLDING_TEXT);
  });

  it("carries no AI tells and invents no team", () => {
    expect(HANDOFF_HOLDING_TEXT).not.toMatch(/[—–;…]/);
    expect(HANDOFF_HOLDING_TEXT.toLowerCase()).not.toContain("team");
  });

  it("would be mangled by lintReply, which is why it never goes through it", () => {
    // The filler-opener rule strips "Good question,". Reply paths send the
    // constant as-is.
    expect(lintReply(HANDOFF_HOLDING_TEXT).text).not.toBe(HANDOFF_HOLDING_TEXT);
  });
});

describe("detectHandoff", () => {
  it("marks the exact markers as well-formed", () => {
    for (const [category, marker] of Object.entries(HANDOFF_MARKERS)) {
      expect(detectHandoff(marker)).toEqual({ category, malformed: false });
    }
  });

  it("returns null for normal replies", () => {
    expect(detectHandoff("we train 4 days a week, mostly strength")).toBeNull();
    expect(detectHandoff("")).toBeNull();
    expect(detectHandoff(undefined)).toBeNull();
  });
});

describe("holdingTextFor: per-account override", () => {
  it("uses users.holding_text when set", () => {
    const text = "Thanks for asking! I'll check with the team and get right back to you.";
    expect(holdingTextFor({ holding_text: text })).toBe(text);
    expect(holdingTextFor({ holding_text: `  ${text}  ` })).toBe(text);
  });

  it("falls back to the default for empty or unsafe overrides", () => {
    for (const bad of [null, "", "   ", "x".repeat(301), "let me check \u2014 back soon", "hi {{name}}", "<<HANDOFF:medical_question>>", "handoff: medical"]) {
      expect(holdingTextFor({ holding_text: bad })).toBe(HANDOFF_HOLDING_TEXT);
    }
    expect(holdingTextFor(undefined)).toBe(HANDOFF_HOLDING_TEXT);
  });
});
