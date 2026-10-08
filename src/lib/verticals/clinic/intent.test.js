import { describe, it, expect } from "vitest";
import { hasClinicIntentSignal, hasInterestPhrase } from "./intent";

const ownerUser = {
  treatment_categories: [
    { key: "botox", match: ["botox", "tox", "dysport"], label: "Botox" },
    { key: "lip_filler", match: ["lips"], label: "lip filler" },
    { key: "hydrafacial", match: ["hydra"], label: "HydraFacial" },
  ],
};
const signal = (commentText, treatmentKey = null, user = ownerUser) => hasClinicIntentSignal({ ownerUser: user, treatmentKey, commentText });

describe("hasClinicIntentSignal", () => {
  it("the live comment", () => {
    expect(signal("I would love to check you guys out... Botox")).toBe(true);
    expect(signal("I would love to check you guys out... Botox", null, {})).toBe(true); // the phrase alone
  });
  it.each([
    "BOTOX", "dysport?", "lips 💋", "lip filler pls", "HydraFacial", // treatments
    "interested!", "I want this", "need", "how much", "price?", "pricing", "book me", "can I book",
    "check you out soon", "can't wait to check y’all out", "me interesa", "cuánto cuesta", "quiero una cita",
  ])("signal: %s", (t) => {
    expect(signal(t)).toBe(true);
  });
  it.each(["so pretty 😍", "congrats on the opening!!", "🔥🔥", "what lane?", "facebook", "notox", "booked solid lol", ""])("no signal: %s", (t) => {
    expect(signal(t)).toBe(false);
  });
  it("the post's tagged treatment label counts even outside its match terms", () => {
    const user = { treatment_categories: [{ key: "hydrafacial", match: ["hydra"], label: "HydraFacial" }] };
    expect(signal("hydrafacial", "hydrafacial", user)).toBe(true);
  });
  it("a key not in the account's list is not a signal", () => {
    expect(signal("laser", "laser")).toBe(false);
  });
});

describe("hasInterestPhrase", () => {
  it("whole words only", () => {
    expect(hasInterestPhrase("wanted")).toBe(false);
    expect(hasInterestPhrase("booking")).toBe(true);
    expect(hasInterestPhrase("handbook")).toBe(false);
  });
});
