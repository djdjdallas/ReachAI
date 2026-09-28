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

// Known defects from audits/dm-classifier-prompt-audit-2026-09-28.md.
// it.fails passes while the defect exists. When PR B fixes one, its test
// starts failing here: flip it to a plain `it` in the same change.
describe("buildSystemPrompt: audit findings (flip to `it` when fixed)", () => {
  it.fails("[P1-10] template adds no em dashes (generic writing rules)", () => {
    expect(buildSystemPrompt(sc, LINK)).not.toContain("—");
  });

  it.fails("[P1-10] template adds no em dashes (voice-profile writing rules)", () => {
    expect(buildSystemPrompt(sc, LINK, { voiceProfile })).not.toContain("—");
  });

  it.fails("[P1-10] voice-profile branch still bans em dashes", () => {
    expect(buildSystemPrompt(sc, LINK, { voiceProfile })).toMatch(/NO em dashes/);
  });

  it.fails("[P0-8] AI-disclosure example does not invent a team", () => {
    expect(buildSystemPrompt(sc, LINK)).not.toMatch(/loop in the team/i);
  });

  it.fails("[P0-8] names the account owner when known", () => {
    expect(buildSystemPrompt(sc, LINK, { ownerName: "Dom" })).toMatch(/\bDom\b/);
  });

  it.fails("[P0-9] grounds on the active offer's price for every thread", () => {
    const p = buildSystemPrompt(sc, LINK, {
      conversation: { origin: "inbound" },
      activeOffer: { offer_name: "Strong Parent", offer_price_cents: 49700 },
    });
    expect(p).toContain("$497");
  });

  it.fails("[P2-12] substitutes {{BOOKING_LINK}} inside the coach's booking message", () => {
    expect(buildSystemPrompt(sc, LINK)).toContain(`here's the link: ${LINK}`);
  });

  it.fails("[P1-11] a 'long' length preference replaces the 2-3 sentence cap", () => {
    expect(buildSystemPrompt({ ...sc, response_length: "long" }, LINK)).not.toMatch(
      /2-3 sentences per message MAX/
    );
  });
});
