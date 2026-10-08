import { describe, it, expect } from "vitest";
import { renderTreatmentTokens, postTreatment, treatmentOptions, DEFAULT_TREATMENT_FALLBACK } from "./treatment";

const user = {
  treatment_categories: [
    { key: "lip_filler", match: ["lips"], label: "lip filler" },
    { key: "chemical-peel", match: ["peel"] },
  ],
};

describe("renderTreatmentTokens", () => {
  it("renders the label", () => {
    expect(renderTreatmentTokens("Curious about {{TREATMENT}}?", "lip filler")).toBe("Curious about lip filler?");
  });
  it("no label: the template's fallback, else the default", () => {
    expect(renderTreatmentTokens("First time trying {{TREATMENT|this treatment}}?", null)).toBe("First time trying this treatment?");
    expect(renderTreatmentTokens("Curious about {{TREATMENT}}?", "")).toBe(`Curious about ${DEFAULT_TREATMENT_FALLBACK}?`);
  });
  it("a label wins over the template's fallback; every occurrence; other tokens untouched", () => {
    expect(renderTreatmentTokens("{{TREATMENT|x}} for {{COMMENTER_NAME}}, {{TREATMENT}}", "Botox")).toBe("Botox for {{COMMENTER_NAME}}, Botox");
  });
});

describe("postTreatment / treatmentOptions", () => {
  it("only keys in the account's list; label or the spaced key", () => {
    expect(postTreatment(user, "lip_filler")).toEqual({ key: "lip_filler", label: "lip filler" });
    expect(postTreatment(user, "chemical-peel")).toEqual({ key: "chemical-peel", label: "chemical peel" });
    expect(postTreatment(user, "laser")).toBeNull();
    expect(postTreatment(user, null)).toBeNull();
    expect(postTreatment({}, "lip_filler")).toBeNull();
  });
  it("options for the picker", () => {
    expect(treatmentOptions(user)).toEqual([
      { key: "lip_filler", label: "lip filler" },
      { key: "chemical-peel", label: "chemical peel" },
    ]);
    expect(treatmentOptions({})).toEqual([]);
  });
});
