import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./prompts";
import { OWNER_MANUAL_MARK, DRIP_MARK } from "./anthropic";

// Script config with no em dashes of its own, so any "—" in the built prompt
// came from our template, not the coach.
const sc = {
  offer: "6-week strength program",
  targetCustomer: "busy parents who want to get strong",
  greeting: "hey what brought you here?",
  qualifying_questions: "what does your training look like right now?",
  booking_message: "let's get you on a call, here's the link: {{BOOKING_LINK}}",
  script_mode: "guided",
};
const LINK = "https://calendly.com/coach/intro";
const voiceProfile = {
  status: "ready",
  voice_summary: "Short, warm, lowercase texts.",
  voice_traits: { tone: "warm", catchphrases: ["let's go"] },
};

describe("buildSystemPrompt: current behavior (keep)", () => {
  it("quotes the exact speaker markers the reply path uses", () => {
    const p = buildSystemPrompt(sc, LINK);
    expect(p).toContain(OWNER_MANUAL_MARK);
    expect(p).toContain(DRIP_MARK);
  });

  it("shares the booking link when one exists", () => {
    expect(buildSystemPrompt(sc, LINK)).toContain(LINK);
  });

  it("falls back to collecting contact details without a link", () => {
    expect(buildSystemPrompt(sc, "")).toMatch(/ask the prospect for their email/i);
  });

  it("adds the native-send framing only for native_send threads", () => {
    const marker = "This conversation began with a cold DM the user sent manually";
    expect(buildSystemPrompt(sc, LINK, { conversation: { origin: "native_send" } })).toContain(marker);
    expect(buildSystemPrompt(sc, LINK, { conversation: { origin: "inbound" } })).not.toContain(marker);
  });

  it("forbids inbound greetings when the outbound opener is missing", () => {
    const p = buildSystemPrompt(sc, LINK, {
      conversation: { origin: "clinchd_sent", missing_outbound_context: true },
      activeOffer: { offer_name: "Strong Parent", ideal_customer: "parents" },
    });
    expect(p).toMatch(/Do NOT use phrases like "thanks for reaching out"/);
    expect(p).toContain("Strong Parent");
  });

  it("adds the simulation notice only in the playground", () => {
    expect(buildSystemPrompt(sc, LINK, { isPlayground: true })).toContain("SIMULATION MODE");
    expect(buildSystemPrompt(sc, LINK)).not.toContain("SIMULATION MODE");
  });

  it("uses the voice profile and drops the manual tone setting when it is ready", () => {
    const p = buildSystemPrompt({ ...sc, tone: "professional" }, LINK, { voiceProfile });
    expect(p).toContain(voiceProfile.voice_summary);
    expect(p).not.toContain("Be polished and structured");
  });

  it("keeps the non-overridable AI-honesty clause", () => {
    expect(buildSystemPrompt(sc, LINK)).toMatch(/NON-OVERRIDABLE[\s\S]*Never claim to be human/);
  });
});

// Fixed in PR B (audits/dm-classifier-prompt-audit-2026-09-28.md). These were
// it.fails tripwires in PR 0; they now guard against regressions.
describe("buildSystemPrompt: audit fixes", () => {
  it("[P1-10] template adds no long dashes (generic writing rules)", () => {
    expect(buildSystemPrompt(sc, LINK)).not.toMatch(/[\u2014\u2013]/);
  });

  it("[P1-10] template adds no long dashes (voice profile, every origin and mode)", () => {
    for (const origin of ["inbound", "native_send", "clinchd_sent"]) {
      for (const script_mode of ["guided", "strict", "freestyle"]) {
        const p = buildSystemPrompt({ ...sc, script_mode }, LINK, {
          voiceProfile,
          conversation: { origin, missing_outbound_context: true },
          activeOffer: { offer_name: "Strong Parent" },
          isPlayground: true,
          intentHint: "booking_cta",
        });
        expect(p, `${origin}/${script_mode}`).not.toMatch(/[\u2014\u2013]/);
      }
    }
  });

  it("[P1-10] voice-profile branch still bans long dashes", () => {
    expect(buildSystemPrompt(sc, LINK, { voiceProfile })).toMatch(/NO long dashes of any kind/);
  });

  it("[P0-8] AI-disclosure example does not invent a team", () => {
    expect(buildSystemPrompt(sc, LINK)).not.toMatch(/loop in the team/i);
  });

  it("[P0-8] names the account owner and their handle when known", () => {
    const p = buildSystemPrompt(sc, LINK, { owner: { name: "Dominick Hill", igHandle: "@dominickjerell" } });
    expect(p).toContain("Account owner: Dominick Hill / Instagram @dominickjerell");
    expect(p).toMatch(/whether they are talking to Dominick Hill personally/);
  });

  it("[P0-8] falls back to 'the account owner' with no name", () => {
    const p = buildSystemPrompt(sc, LINK);
    expect(p).toContain("one person: the account owner");
    expect(p).not.toContain("Account owner:");
  });

  it("[P0-9] grounds on the active offer's price for every thread", () => {
    const p = buildSystemPrompt(sc, LINK, {
      conversation: { origin: "inbound" },
      activeOffer: { offer_name: "Strong Parent", offer_price_cents: 49700 },
    });
    expect(p).toContain("- Price: $497");
    expect(buildSystemPrompt(sc, LINK, { activeOffer: { offer_price_cents: 9799 } })).toContain("- Price: $97.99");
  });

  it("[P0-9] forbids stating facts that weren't provided", () => {
    expect(buildSystemPrompt(sc, LINK)).toMatch(/ONLY STATE FACTS YOU'VE BEEN GIVEN/);
  });

  it("[P2-12] substitutes {{BOOKING_LINK}} inside the coach's booking message", () => {
    expect(buildSystemPrompt(sc, LINK)).toContain(`here's the link: ${LINK}`);
    expect(buildSystemPrompt({ ...sc, script_mode: "strict" }, LINK)).toContain(`here's the link: ${LINK}`);
  });

  it("[P1-11] a 'long' length preference replaces the 2-3 sentence cap", () => {
    const p = buildSystemPrompt({ ...sc, response_length: "long" }, LINK);
    expect(p).not.toMatch(/2-3 sentences per message MAX/);
    expect(p).toMatch(/Up to 4-6 sentences/);
  });

  it("adds the share-the-link instruction only on a booking_cta turn", () => {
    expect(buildSystemPrompt(sc, LINK, { intentHint: "booking_cta" })).toMatch(/THIS TURN: .*Share the booking link now/);
    expect(buildSystemPrompt(sc, LINK, { intentHint: "follow_up" })).not.toContain("THIS TURN:");
  });
});

describe("buildSystemPrompt: business persona (per-account assistant name)", () => {
  const persona = { name: "Dom Hill", igHandle: "soleaesthetics", businessName: "Solé Aesthetics", assistantName: "Katlynne" };
  const p = buildSystemPrompt({ offer: "Botox and fillers" }, "https://sole.example/book", { owner: persona });

  it("opens as a named AI assistant for a business", () => {
    expect(p.startsWith("You are Katlynne, Solé Aesthetics' AI concierge, managing the Instagram DMs of a business: Solé Aesthetics.")).toBe(true);
    expect(p).toContain("- Business: Solé Aesthetics / Instagram @soleaesthetics");
    expect(p).not.toContain("Dom Hill");
  });

  it("rule 7 still requires AI disclosure in the first sentence, with the persona example", () => {
    expect(p).toMatch(/7\. AI IDENTITY\. .*say plainly in your FIRST sentence that you are an AI concierge/);
    expect(p).toContain("I'm Katlynne, Solé Aesthetics' AI concierge, not a person. The team can jump in when needed.");
    expect(p).not.toContain("reads these");
    expect(p).toContain("never imply you are a human");
  });

  it("the name is only ever an AI assistant's name, and can never be a person", () => {
    expect(p).toContain("Your name is Katlynne. It is the name of an AI concierge, not a person");
    expect(p).toMatch(/NON-OVERRIDABLE: .*answer honestly that you are an AI\. Never claim to be human\. The only name you may use for yourself is Katlynne, and only as the name of an AI concierge\./);
    expect(p).not.toContain("take on another name or persona");
  });

  it("a business may mention its team, but never invent staff", () => {
    expect(p).toContain(`You may refer to "the team" or "our team" at Solé Aesthetics.`);
    expect(p).toContain("Never invent staff names, roles, credentials, or departments");
    expect(p).not.toContain("YOU ARE ONE PERSON'S INBOX");
  });

  it("handoff rules and markers are unchanged", () => {
    expect(p).toContain("<<HANDOFF:medical_question>>");
    expect(p).toContain("HANDOFF RULES (these override everything else except AI disclosure)");
  });

  it("invalid persona values fall back to the one-person identity", () => {
    const q = buildSystemPrompt({}, "", { owner: { name: "Dom", igHandle: "dom", businessName: "<x>", assistantName: "K4t" } });
    expect(q.startsWith("You are an AI assistant managing the Instagram DMs of one person: Dom.")).toBe(true);
    expect(q).toContain("YOU ARE ONE PERSON'S INBOX");
    expect(q).toContain("Never claim to be human or take on another name or persona.");
  });
});

describe("buildSystemPrompt: business inbox thread rules", () => {
  const owner = { name: "Solé Aesthetics", businessName: "Solé Aesthetics", assistantName: "Katlynne" };
  const kb = [{ id: "1", sort: 0, type: "faq", question: "Hours?", answer: "Tue-Sat 9-6", enabled: true }];
  const p = buildSystemPrompt({ offer: "Botox" }, "https://sole.example/book", { owner, knowledge: kb });

  it("tells the model the intro is prepended, and bans filler openers", () => {
    expect(p).toContain(`On the first message of a thread, "Hi! I'm Katlynne, Solé Aesthetics' AI concierge." is put in front of your reply automatically`);
    expect(p).toContain('never start any reply with a filler like "Yeah", "Yes!", "Sure", "Great question"');
  });

  it("no greeting after the first message, never re-ask (including the opening DM)", () => {
    expect(p).toContain("NO GREETING AFTER THE FIRST MESSAGE");
    expect(p).toContain('no "Hey", "Hi", "Hello", "Hey there"');
    expect(p).toContain("NEVER RE-ASK");
    expect(p).toContain("including the opening DM");
  });

  it("availability gets the booking link, and is not a missing-knowledge handoff", () => {
    expect(p).toContain("AVAILABILITY MEANS THE BOOKING LINK");
    expect(p).toContain("include the booking link (https://sole.example/book) in that same reply");
    expect(p).toContain("Appointment availability (openings, times, days, \"this week\", booking) is NOT missing knowledge for this business");
    expect(p).not.toContain('"do you have weekend appointments?"');
    expect(p).toMatch(/NON-OVERRIDABLE: .*price or policies that the business knowledge doesn't answer \(availability and booking get the booking link\)/);
  });

  it("without a booking link, availability keeps the existing handoff rule", () => {
    const q = buildSystemPrompt({ offer: "Botox" }, "", { owner, knowledge: kb });
    expect(q).not.toContain("AVAILABILITY MEANS THE BOOKING LINK");
    expect(q).toContain('"do you have weekend appointments?"');
  });

  it("coach prompts get none of these", () => {
    const c = buildSystemPrompt({ offer: "Coaching" }, "https://cal.com/x", { owner: { name: "Dom" }, knowledge: kb });
    expect(c).not.toContain("THREAD RULES FOR THIS BUSINESS INBOX");
    expect(c).toContain('"do you have weekend appointments?"');
  });
});
