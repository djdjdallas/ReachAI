import { describe, it, expect } from "vitest";
import { looksLikeComplaint } from "./complaint";

describe("looksLikeComplaint", () => {
  it.each([
    "I want my money back",
    "still waiting on my refund",
    "my lips are still lumpy 3 weeks later, is that normal?",
    "the filler migrated above my lip line",
    "left eyelid has been droopy since my botox",
    "what are the side effects? my face feels weird",
    "I think it got infected",
    "had an allergic reaction after the peel",
    "they botched my lips",
    "worst experience ever, never coming back",
    "still swollen after 2 weeks",
    "the swelling won’t go away",
    "Quiero un reembolso",
    "tuve efectos secundarios",
  ])("complaint: %s", (text) => {
    expect(looksLikeComplaint(text)).toBe(true);
  });

  it.each([
    "how much is lip filler?",
    "BOTOX",
    "do you have openings saturday?",
    "can you help with uneven skin tone?",
    "do you treat acne scarred skin?",
    "I want to dissolve my old filler from another place",
    "you won't regret it girl 😍",
    "Sue you need this",
    "so pretty!! 🔥",
    "er how long does it last",
    "",
  ])("not a complaint: %s", (text) => {
    expect(looksLikeComplaint(text)).toBe(false);
  });

  it("handles null", () => {
    expect(looksLikeComplaint(null)).toBe(false);
  });
});
