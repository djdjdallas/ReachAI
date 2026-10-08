import { describe, it, expect } from "vitest";
import {
  extractEmail,
  extractPhone,
  normalizePhone,
  normalizeTreatmentCategories,
  matchTreatment,
  captureLeadFacts,
  findTreatment,
  treatmentLabel,
} from "./lead-capture";
import { fakeDb } from "@/lib/test-utils/fake-db";

describe("extractEmail", () => {
  it("finds one email, lowercased", () => {
    expect(extractEmail("sure it's Jane.Doe@Example.com thanks")).toBe("jane.doe@example.com");
  });
  it("drops a trailing period", () => {
    expect(extractEmail("email me at jane@example.com.")).toBe("jane@example.com");
  });
  it("is null for none or two different addresses (ambiguous)", () => {
    expect(extractEmail("no email here")).toBeNull();
    expect(extractEmail("a@example.com or b@example.com")).toBeNull();
    expect(extractEmail("@janedoe on ig")).toBeNull();
  });
  it("the same address twice is not ambiguous", () => {
    expect(extractEmail("a@example.com, yes a@example.com")).toBe("a@example.com");
  });
});

describe("phone normalization (US default)", () => {
  it.each([
    ["(512) 555-0123", "+15125550123"],
    ["512.555.0123", "+15125550123"],
    ["5125550123", "+15125550123"],
    ["1-512-555-0123", "+15125550123"],
    ["+1 512 555 0123", "+15125550123"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s → %s", (raw, e164) => {
    expect(normalizePhone(raw)).toBe(e164);
  });

  it.each(["555-0123", "123-456-7890", "011 44 20 7946 0958", "+1 123 456 7890", "51255501234", "411-555-0123"])(
    "drops %s",
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    }
  );

  it("extracts one number from text; two different numbers is ambiguous", () => {
    expect(extractPhone("call me 512-555-0123 after 5")).toBe("+15125550123");
    expect(extractPhone("512-555-0123 or 737-555-0199")).toBeNull();
  });

  it("does not read prices, dates or times as phones", () => {
    expect(extractPhone("is it $1,500 or $2,000?")).toBeNull();
    expect(extractPhone("free on 10/12/2026 at 3:30")).toBeNull();
    expect(extractPhone("2026-10-06")).toBeNull();
  });
});

describe("treatment categories", () => {
  const cats = normalizeTreatmentCategories([
    { key: "botox", match: ["botox", "tox", "dysport"] },
    { key: "lip_filler", match: ["lip filler", "lips"] },
    { key: "BAD KEY", match: ["x"] },
    { key: "laser_hair_removal" },
  ]);

  it("drops invalid keys and defaults match terms to the key", () => {
    expect(cats.map((c) => c.key)).toEqual(["botox", "lip_filler", "laser_hair_removal"]);
    expect(cats[2].match).toEqual(["laser hair removal"]);
  });

  it("returns the category key whose term appears first, as whole words", () => {
    expect(matchTreatment(cats, "Hi! How much for lip filler and maybe botox?")).toBe("lip_filler");
    expect(matchTreatment(cats, "BOTOX please")).toBe("botox");
    expect(matchTreatment(cats, "I'm toxic lol")).toBeNull();
    expect(matchTreatment(cats, "interested in laser hair removal")).toBe("laser_hair_removal");
  });

  it("never returns lead text", () => {
    expect(matchTreatment(cats, "I have migraines, can botox help my condition?")).toBe("botox");
    expect(matchTreatment([], "botox")).toBeNull();
    expect(normalizeTreatmentCategories("botox")).toEqual([]);
  });
});

describe("captureLeadFacts", () => {
  const base = () =>
    fakeDb(
      {
        outbound_webhooks: [{ id: "w1", user_id: "u1", enabled: true }],
        users: [{ id: "u1", treatment_categories: [{ key: "botox", match: ["botox"] }] }],
        lead_profiles: [],
      },
      { unique: { lead_profiles: "conversation_id" } }
    );

  it("stores validated facts only", async () => {
    const db = base();
    const r = await captureLeadFacts(db, {
      userId: "u1",
      conversationId: "c1",
      text: "botox pls, I'm jane@example.com / 512 555 0123. I'm pregnant btw",
      instagramUsername: "jane.doe",
    });
    expect(r.written).toBe(true);
    expect(db.tables.lead_profiles[0]).toMatchObject({
      conversation_id: "c1",
      user_id: "u1",
      instagram_username: "jane.doe",
      email: "jane@example.com",
      phone: "+15125550123",
      treatment_interest: "botox",
    });
    expect(JSON.stringify(db.tables.lead_profiles)).not.toMatch(/pregnant/);
  });

  it("does nothing for an account without an enabled webhook", async () => {
    const db = base();
    db.tables.outbound_webhooks[0].enabled = false;
    const r = await captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "jane@example.com" });
    expect(r.written).toBe(false);
    expect(db.tables.lead_profiles).toHaveLength(0);
  });

  it("latest email wins; treatment and username keep the first value", async () => {
    const db = base();
    await captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "botox, a@example.com", instagramUsername: "first" });
    await captureLeadFacts(db, {
      userId: "u1",
      conversationId: "c1",
      text: "sorry it's b@example.com",
      instagramUsername: "second",
      treatmentCategories: [{ key: "filler", match: ["sorry"] }],
    });
    expect(db.tables.lead_profiles[0]).toMatchObject({ email: "b@example.com", instagram_username: "first", treatment_interest: "botox" });
  });

  it("writes nothing when the message has nothing new", async () => {
    const db = base();
    const r = await captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "hi!" });
    expect(r.written).toBe(false);
    expect(db.tables.lead_profiles).toHaveLength(0);
  });

  it("never throws", async () => {
    const db = { from: () => { throw new Error("boom"); } };
    await expect(captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "x" })).resolves.toEqual({ written: false });
  });
});

describe("treatment labels", () => {
  const cats = [
    { key: "lip_filler", match: ["lip filler"], label: "lip filler" },
    { key: "botox", match: ["botox"] },
    { key: "laser", match: ["laser"], label: "<b>laser</b>" },
  ];
  it("keeps a valid label and drops an invalid one", () => {
    const out = normalizeTreatmentCategories(cats);
    expect(out[0].label).toBe("lip filler");
    expect(out[1]).not.toHaveProperty("label");
    expect(out[2]).not.toHaveProperty("label");
  });
  it("treatmentLabel: the label, else the key with spaces, else null", () => {
    expect(treatmentLabel(cats, "lip_filler")).toBe("lip filler");
    expect(treatmentLabel([{ key: "chemical-peel", match: [] }], "chemical-peel")).toBe("chemical peel");
    expect(treatmentLabel(cats, "botox")).toBe("botox");
    expect(treatmentLabel(cats, "nope")).toBeNull();
    expect(treatmentLabel(cats, null)).toBeNull();
  });
  it("findTreatment only returns keys in the list", () => {
    expect(findTreatment(cats, "botox")?.key).toBe("botox");
    expect(findTreatment(cats, "BOTOX")).toBeNull();
    expect(findTreatment(null, "botox")).toBeNull();
  });
});

describe("captureLeadFacts with a post treatment", () => {
  const setup = (profiles = []) =>
    fakeDb(
      {
        users: [{ id: "u1", treatment_categories: [{ key: "botox", match: ["botox"] }, { key: "lip_filler", match: ["lips"] }] }],
        outbound_webhooks: [{ id: "w1", user_id: "u1", enabled: true }],
        lead_profiles: profiles,
      },
      { unique: { lead_profiles: "conversation_id" } }
    );

  it("seeds treatment_interest from the post's tag before matching the text", async () => {
    const db = setup();
    await captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "how much for botox", treatmentKey: "lip_filler" });
    expect(db.tables.lead_profiles[0].treatment_interest).toBe("lip_filler");
  });
  it("a tag not in the account's list falls back to the text", async () => {
    const db = setup();
    await captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "how much for botox", treatmentKey: "laser" });
    expect(db.tables.lead_profiles[0].treatment_interest).toBe("botox");
  });
  it("never overwrites a treatment already known", async () => {
    const db = setup([{ conversation_id: "c1", user_id: "u1", treatment_interest: "botox" }]);
    await captureLeadFacts(db, { userId: "u1", conversationId: "c1", text: "hi", treatmentKey: "lip_filler" });
    expect(db.tables.lead_profiles[0].treatment_interest).toBe("botox");
  });
});
