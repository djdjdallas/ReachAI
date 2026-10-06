import { describe, it, expect } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";
import {
  applyDisclosure,
  conversationHasDisclosed,
  disclosureLine,
  discloseOnFirstMessage,
  possessive,
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

  it("never doubles: text that already carries it, or already says it's an AI first", () => {
    expect(applyDisclosure(`${LINE} First time?`, LINE)).toBe(`${LINE} First time?`);
    expect(applyDisclosure("I'm Katlynne, an AI assistant for Solé Aesthetics, not a person. What can I help with?", LINE)).toBe(
      "I'm Katlynne, an AI assistant for Solé Aesthetics, not a person. What can I help with?"
    );
  });
});

describe("conversationHasDisclosed", () => {
  const db = (messages) => fakeDb({ messages });
  const m = (o) => ({ conversation_id: "c1", role: "assistant", source: "agent", provider_message_id: "mid", content: "x", ...o });

  it("no thread or no messages: not yet", async () => {
    expect(await conversationHasDisclosed(db([]), null)).toBe(false);
    expect(await conversationHasDisclosed(db([]), "c1")).toBe(false);
  });
  it("a sent app message (agent or drip) means the lead has been told", async () => {
    expect(await conversationHasDisclosed(db([m({})]), "c1")).toBe(true);
    expect(await conversationHasDisclosed(db([m({ source: "drip" })]), "c1")).toBe(true);
  });
  it("an unsent app message (no Meta id) does not count", async () => {
    expect(await conversationHasDisclosed(db([m({ provider_message_id: null })]), "c1")).toBe(false);
  });
  it("staff messages count only if they carry the disclosure (echoed comment opener)", async () => {
    expect(await conversationHasDisclosed(db([m({ source: "manual", content: "hi from the clinic" })]), "c1")).toBe(false);
    expect(await conversationHasDisclosed(db([m({ source: "manual", content: `${LINE} Thanks!` })]), "c1")).toBe(true);
  });
  it("lead messages and other threads don't count", async () => {
    expect(await conversationHasDisclosed(db([m({ role: "user", source: "lead" }), m({ conversation_id: "c2" })]), "c1")).toBe(false);
  });
  it("a failed read errs toward disclosing", async () => {
    expect(await conversationHasDisclosed(fakeDb({ messages: [m({})] }, { failOn: { messages: { code: "x" } } }), "c1")).toBe(false);
  });
});

describe("discloseOnFirstMessage", () => {
  it("first message of a persona thread gets it; once sent, never again; coaches never", async () => {
    const db = fakeDb({ messages: [] });
    expect(await discloseOnFirstMessage(db, persona, "Hey! Pricing is at your consult.", { conversationId: "c1" })).toBe(
      `${LINE} Pricing is at your consult.`
    );
    db.tables.messages.push({ conversation_id: "c1", role: "assistant", source: "agent", provider_message_id: "m1", content: `${LINE} Pricing is at your consult.` });
    expect(await discloseOnFirstMessage(db, persona, "Which area?", { conversationId: "c1" })).toBe("Which area?");
    expect(await discloseOnFirstMessage(db, { full_name: "Dom" }, "Hey! $550.", { conversationId: "c9" })).toBe("Hey! $550.");
  });

  it("a drip that is the first thing sent carries it", async () => {
    const db = fakeDb({ messages: [{ conversation_id: "c1", role: "assistant", source: "agent", provider_message_id: null, content: "never sent" }] });
    expect(await discloseOnFirstMessage(db, persona, "Still thinking about Botox?", { conversationId: "c1" })).toBe(`${LINE} Still thinking about Botox?`);
  });
});
