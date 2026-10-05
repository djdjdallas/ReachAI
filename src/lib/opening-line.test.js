import { describe, it, expect } from "vitest";
import {
  validateOpeningLine,
  hasOpeningLine,
  OPENING_LINE_MAX,
  openingLineDbErrorMessage,
} from "./opening-line";

describe("validateOpeningLine", () => {
  it("accepts and trims a real line", () => {
    expect(validateOpeningLine("  Hey! What made you reach out?  ")).toEqual({
      ok: true,
      value: "Hey! What made you reach out?",
    });
  });
  it.each([[""], ["   "], [null], [undefined], [42]])("rejects %j", (v) => {
    expect(validateOpeningLine(v).ok).toBe(false);
  });
  it("caps length at Instagram's DM limit", () => {
    expect(validateOpeningLine("a".repeat(OPENING_LINE_MAX)).ok).toBe(true);
    expect(validateOpeningLine("a".repeat(OPENING_LINE_MAX + 1)).ok).toBe(false);
  });
});

describe("hasOpeningLine", () => {
  it("reads script_config.greeting", () => {
    expect(hasOpeningLine({ greeting: "Hi" })).toBe(true);
    expect(hasOpeningLine({ greeting: "  " })).toBe(false);
    expect(hasOpeningLine({})).toBe(false);
    expect(hasOpeningLine(null)).toBe(false);
  });
});

describe("openingLineDbErrorMessage", () => {
  it("maps the trigger's errors to plain copy", () => {
    expect(openingLineDbErrorMessage({ message: "opening_line_required: the AI cannot be on without an opening line" })).toMatch(
      /needs an opening line/
    );
    expect(openingLineDbErrorMessage({ message: "opening_line_required: too_long" })).toMatch(/under 1000/);
  });
  it("ignores other errors", () => {
    expect(openingLineDbErrorMessage({ message: "network" })).toBeNull();
    expect(openingLineDbErrorMessage(null)).toBeNull();
  });
  it("has no long dashes", () => {
    const all = [
      openingLineDbErrorMessage({ message: "opening_line_required: x" }),
      openingLineDbErrorMessage({ message: "opening_line_required: too_long" }),
      validateOpeningLine("").error,
    ].join(" ");
    expect(all).not.toMatch(/[–—]/);
  });
});
