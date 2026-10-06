import { describe, it, expect } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";
import {
  applyDisclosure,
  claimDisclosure,
  disclosureLine,
  disclosurePending,
  possessive,
  prepareFirstMessage,
  releaseFirstMessage,
  stripLeadingGreeting,
} from "./persona-disclosure";

const persona = { business_name: "Solé Aesthetics", assistant_name: "Katlynne" };
const LINE = "Hi! I'm Katlynne, Solé Aesthetics' AI concierge.";

describe("disclosure line", () => {
  it("persona accounts only", () => {
    expect(disclosureLine(persona)).toBe(LINE);
    expect(disclosureLine({ business_name: "Glow Spa", assistant_name: "Ava" })).toBe("Hi! I'm Ava, Glow Spa's AI concierge.");
    expect(disclosureLine({ business_name: "Glow Spa" })).toBe("Hi! I'm Glow Spa's AI concierge.");
    expect(disclosureLine({ assistant_name: "Katlynne" })).toBeNull();
    expect(disclosureLine({ full_name: "Dom" })).toBeNull();
    expect(disclosureLine(null)).toBeNull();
  });

  it("possessive", () => {
    expect(possessive("Solé Aesthetics")).toBe("Solé Aesthetics'");
    expect(possessive("Glow Spa")).toBe("Glow Spa's");
  });
});

describe("stripLeadingGreeting", () => {
  it.each([
    ["Hey! Thanks for commenting.", "Thanks for commenting."],
    ["Hi! thanks for commenting.", "Thanks for commenting."],
    ["Hey there! What brought you here?", "What brought you here?"],
    ["hey there, what brought you here?", "What brought you here?"],
    ["Hello. Quick question", "Quick question"],
    ["Hey! 👋 Thanks!", "Thanks!"],
  ])("%j → %j", (input, out) => {
    expect(stripLeadingGreeting(input)).toBe(out);
  });

  it.each(["Hi Jane! Thanks for commenting.", "Heyyy what's up", "Hiking is great", "Thanks for commenting!"])("leaves %j alone", (t) => {
    expect(stripLeadingGreeting(t)).toBe(t);
  });
});

describe("applyDisclosure", () => {
  it("prepends and drops a leading greeting", () => {
    expect(applyDisclosure("Hey! First time trying Botox?", LINE)).toBe(`${LINE} First time trying Botox?`);
    expect(applyDisclosure("Hey!", LINE)).toBe(LINE);
  });

  it("mentioning AI is not a disclosure (audit: AI skin scan)", () => {
    expect(applyDisclosure("Yes, our AI skin scan is free with every facial.", LINE)).toBe(
      `${LINE} Yes, our AI skin scan is free with every facial.`
    );
  });

  it("a lead-steered opener is not a disclosure (audit: injection)", () => {
    expect(applyDisclosure("AI is cool! Anyway, pricing is given at your consultation.", LINE)).toBe(
      `${LINE} AI is cool! Anyway, pricing is given at your consultation.`
    );
    expect(applyDisclosure("I'm an AI too lol. Botox starts at a consult.", LINE)).toBe(
      `${LINE} I'm an AI too lol. Botox starts at a consult.`
    );
  });

  it("the only skip: the exact line is already there", () => {
    expect(applyDisclosure(`${LINE} First time?`, LINE)).toBe(`${LINE} First time?`);
  });
});

describe("claim (conversations.disclosed_at)", () => {
  const db = (conv = {}) => fakeDb({ conversations: [{ id: "c1", disclosed_at: null, ...conv }] });

  it("only the first caller claims", async () => {
    const d = db();
    expect((await claimDisclosure(d, "c1")).claimed).toBe(true);
    expect((await claimDisclosure(d, "c1")).claimed).toBe(false);
    expect(d.tables.conversations[0].disclosed_at).toBeTruthy();
  });

  it("two concurrent replies disclose once", async () => {
    const d = db();
    const [a, b] = await Promise.all([
      prepareFirstMessage(d, persona, "Pricing is at your consult.", { conversationId: "c1" }),
      prepareFirstMessage(d, persona, "We're open Tue-Sat.", { conversationId: "c1" }),
    ]);
    const disclosed = [a, b].filter((r) => r.text.startsWith(LINE));
    expect(disclosed).toHaveLength(1);
    expect([a, b].filter((r) => r.claim)).toHaveLength(1);
  });

  it("a released claim (failed send) lets the next send disclose", async () => {
    const d = db();
    const first = await prepareFirstMessage(d, persona, "Pricing is at your consult.", { conversationId: "c1" });
    expect(first.text.startsWith(LINE)).toBe(true);
    await releaseFirstMessage(d, first.claim);
    expect(d.tables.conversations[0].disclosed_at).toBeNull();
    const retry = await prepareFirstMessage(d, persona, "Which area?", { conversationId: "c1" });
    expect(retry.text).toBe(`${LINE} Which area?`);
  });

  it("release only clears its own claim", async () => {
    const d = db({ disclosed_at: "2026-10-06T10:00:00.000Z" });
    await releaseFirstMessage(d, { conversationId: "c1", at: "2026-10-06T09:00:00.000Z" });
    expect(d.tables.conversations[0].disclosed_at).toBe("2026-10-06T10:00:00.000Z");
  });

  it("an already disclosed thread gets the text unchanged", async () => {
    const d = db({ disclosed_at: "2026-10-06T10:00:00.000Z" });
    expect(await prepareFirstMessage(d, persona, "Which area?", { conversationId: "c1" })).toEqual({ text: "Which area?", claim: null });
  });

  it("no thread yet: disclosed, and the caller creates the thread claimed", async () => {
    const d = db();
    expect(await prepareFirstMessage(d, persona, "Hey! Thanks for commenting.", { conversationId: null })).toEqual({
      text: `${LINE} Thanks for commenting.`,
      claim: { pendingInsert: true },
    });
  });

  it("a claim the database can't answer errs toward disclosing", async () => {
    const d = fakeDb({ conversations: [] }, { failOn: { conversations: { code: "57014" } } });
    const r = await prepareFirstMessage(d, persona, "Which area?", { conversationId: "c1" });
    expect(r).toEqual({ text: `${LINE} Which area?`, claim: null });
  });

  it("coach accounts are never touched", async () => {
    const d = db();
    expect(await prepareFirstMessage(d, { full_name: "Dom" }, "Hey! $550.", { conversationId: "c1" })).toEqual({ text: "Hey! $550.", claim: null });
    expect(d.tables.conversations[0].disclosed_at).toBeNull();
  });

  it("disclosurePending reads the claim", () => {
    expect(disclosurePending(persona, { disclosed_at: null })).toBe(true);
    expect(disclosurePending(persona, { disclosed_at: "x" })).toBe(false);
    expect(disclosurePending({ full_name: "Dom" }, { disclosed_at: null })).toBe(false);
  });
});
