import { describe, it, expect } from "vitest";
import { looksLikeComplaint } from "./complaint";

describe("looksLikeComplaint", () => {
  it.each([
    "I want my money back",
    "still waiting on my refund",
    "my lips are still lumpy 3 weeks later, is that normal?",
    "the filler migrated above my lip line",
    "left eyelid has been droopy since my botox",
    "having side effects since my appointment, my face feels weird",
    "left side is lopsided after the filler you did",
    "my brows are drooping from my appointment last week",
    "asymmetrical smile since botox here",
    "los demandaré",
    "voy a demandar a la clínica",
    "I think it got infected",
    "had an allergic reaction after the peel",
    "they botched my lips",
    "worst experience ever, never coming back",
    "still swollen after 2 weeks",
    "the swelling won’t go away",
    "Quiero un reembolso",
    "tuve efectos secundarios después de la cita",
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
    // Real inquiries (review of #57): never hand off.
    "what are the side effects?",
    "can botox help my droopy brows?",
    "lopsided lips, can filler fix that?",
    "burnt out, need a facial",
    "hay mucha demanda para el botox?",
    "are side effects common with lip filler?",
    "¿cuáles son los efectos secundarios?",
  ])("not a complaint: %s", (text) => {
    expect(looksLikeComplaint(text)).toBe(false);
  });

  it("handles null", () => {
    expect(looksLikeComplaint(null)).toBe(false);
  });
});
