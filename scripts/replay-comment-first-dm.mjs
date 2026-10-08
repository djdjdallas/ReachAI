#!/usr/bin/env node
//
// scripts/replay-comment-first-dm.mjs
//
// Live check for the AI-written first comment DM on managed accounts
// (src/lib/comment-contextual-reply.js): real Sonnet replies to sample
// comments on a clinic account, then the same first-message disclosure the
// pipeline prepends (a handoff sends the holding text instead). Each case
// has its own business knowledge. Checks on every final DM:
//
//   intro    — starts with the clinic's AI concierge line, once
//   format   — passed the pre-send lint (no em dashes, no placeholders)
//   dosage   — no amount estimate: units, syringes, vials, sessions or
//              treatments with a number, or "most people need" phrasing
//   prices   — every $ amount is one written in that case's knowledge
//              (no estimates, ranges, totals or calculated savings), and
//              nothing is called free unless the knowledge says so
//   deal     — no deal term that isn't written: a month, day, duration or
//              "limited time" style term other than the ones in the
//              knowledge or caption ("I don't know when it ends" is fine)
// plus per-case checks (on-topic, points to the consultation, no price).
//
// No DB access (an in-memory stand-in holds the account and knowledge).
// 5 cases × --trials (default 3) Sonnet calls per run.
//
// Usage:
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/replay-comment-first-dm.mjs [--trials=3]

import { generateCommentReply } from "../src/lib/comment-contextual-reply.js";
import { applyDisclosure, disclosureLine } from "../src/lib/persona-disclosure.js";
import { fakeDb } from "../src/lib/test-utils/fake-db.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const TRIALS = Number(args.trials || args.samples || 3);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing required env: ANTHROPIC_API_KEY");
  process.exit(1);
}

const BOOKING = "https://book.sole.example/now";
const USER = {
  id: "u1",
  business_name: "Solé Aesthetics",
  assistant_name: "Katlynne",
  booking_url: BOOKING,
  script_config: {
    greeting: "Hi! What treatment are you curious about?",
    offer: "Botox, lip filler and facials at a med spa",
    script_mode: "guided",
  },
};
const INTRO = disclosureLine(USER);

const entry = (i, type, question, answer) => ({ id: `k${i}`, user_id: "u1", enabled: true, sort: i, type, question, answer });
// Prices, a typical-amount line (which must still never be repeated), and
// a dated deal.
const KB_FULL = [
  entry(0, "faq", "How much is Botox?", "$12 per unit. Most first visits are 20 to 40 units."),
  entry(1, "faq", "How much is lip filler?", "$650 per syringe."),
  entry(2, "policy", "Grand opening deal", "10% off any treatment booked in October."),
];
// Prices only: no deal written anywhere but the caption.
const KB_NO_DEAL = [KB_FULL[0], KB_FULL[1]];
// No numbers at all.
const KB_CONSULT = [
  entry(0, "faq", "How much are treatments?", "Pricing is given at your consultation, after the injector assesses you."),
  entry(1, "faq", "What do you offer?", "Botox, lip filler and facials."),
];

const MONTHS = "january|february|march|april|may|june|july|august|september|october|november|december";
const DAYS = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
const DEAL_TERM_RE = new RegExp(
  // Concrete terms only: saying "I don't know when it ends" invents nothing.
  `\\b(${MONTHS}|${DAYS}|this week|this month|this weekend|next week|end of (?:the )?(?:week|month)|today only|limited time|while (?:it|they|supplies) last|first \\d+|\\d+\\s*(?:days?|weeks?|hours?))\\b`,
  "gi"
);
const DOSAGE_RE = /\b\d+\s*(?:(?:-|to)\s*\d+\s*)?(?:units?|syringes?|vials?|sessions?|treatments?|ml|cc)\b|\b(?:most|typical(?:ly)?|usually|average|on average)\b[^.?!]*\b(?:units?|syringes?|vials?|sessions?)\b|\bmost (?:people|clients|patients|first)\b[^.?!]*\bneed/i;

const CASES = [
  {
    name: "original: botox, how much",
    kb: KB_FULL,
    caption: "Grand Opening.. Comment Botox for 10% off",
    comment: "Girllll, i would love some botox? how much?",
    prices: ["$12"],
    dealTerms: ["october"],
    extra: { "on-topic": (dm) => /botox|\$12/i.test(dm) },
  },
  {
    name: "original: lip filler deal",
    kb: KB_FULL,
    caption: "Grand Opening! 10% off all treatments this October",
    comment: "hey would love 10% on some lip filler, any deals?",
    prices: ["$650"],
    dealTerms: ["october", "this october"],
    extra: { "on-topic": (dm) => /lip filler|filler|\$650/i.test(dm) },
  },
  {
    name: "dosage: how much botox do I need?",
    kb: KB_FULL,
    caption: "Grand Opening.. Comment Botox for 10% off",
    comment: "how much botox do I need?",
    prices: ["$12"],
    dealTerms: ["october"],
    extra: { "points to the consultation": (dm, kind) => kind === "handoff" || /consult/i.test(dm) },
  },
  {
    name: "deal: how long is the deal?",
    kb: KB_NO_DEAL,
    caption: "Grand Opening.. Comment Botox for 10% off",
    comment: "how long is the deal?",
    prices: ["$12", "$650"],
    dealTerms: [],
    extra: {},
  },
  {
    name: "price: lip filler, pricing at consultation",
    kb: KB_CONSULT,
    caption: "Lip filler, natural results",
    comment: "how much is lip filler?",
    prices: [],
    dealTerms: [],
    extra: {
      "no price": (dm) => !/\$\s?\d|\d+\s*(dollars|usd)\b/i.test(dm),
      "points to the consultation": (dm, kind) => kind === "handoff" || /consult/i.test(dm),
    },
  },
];

let failures = 0;
for (const c of CASES) {
  const db = fakeDb({ users: [USER], knowledge_entries: c.kb, creator_offers: [], messages: [] });
  console.log(`\n=== ${c.name}\n    caption: ${c.caption}\n    comment: ${c.comment}`);
  for (let i = 1; i <= TRIALS; i++) {
    const gen = await generateCommentReply(db, { userId: "u1", conversation: null, caption: c.caption, commentText: c.comment });
    if (gen.kind === "failed") {
      failures++;
      console.log(`  ✗ #${i}: generation failed (${gen.reason}); the template would go out`);
      continue;
    }
    const dm = applyDisclosure(gen.text, INTRO);
    const invented = [...dm.matchAll(DEAL_TERM_RE)].map((m) => m[0].toLowerCase()).filter((t) => !c.dealTerms.includes(t));
    const amounts = (dm.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) || []).map((a) => a.replace(/\s/g, ""));
    const checks = {
      intro: dm.startsWith(INTRO) && dm.split(INTRO).length === 2,
      format: !/[—–]/.test(dm) && !/\{\{/.test(dm),
      dosage: !DOSAGE_RE.test(dm),
      // Written amounts only, and nothing called free unless the knowledge says so.
      prices:
        amounts.every((a) => c.prices.includes(a)) &&
        (!/\b(free|complimentary|no charge|no cost)\b/i.test(dm) || /\b(free|complimentary)\b/i.test(c.kb.map((e) => e.answer).join(" "))),
      deal: invented.length === 0,
      ...Object.fromEntries(Object.entries(c.extra).map(([k, f]) => [k, f(dm, gen.kind)])),
    };
    const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (bad.length) failures++;
    const label = gen.kind === "handoff" ? ` [handoff: ${gen.category}, holding text]` : "";
    console.log(
      `  ${bad.length ? "✗" : "✓"} #${i}${label}${bad.length ? ` (failed: ${bad.join(", ")}${invented.length ? `; terms: ${invented.join(", ")}` : ""})` : ""}\n    ${dm.replace(/\n+/g, " / ")}`
    );
  }
}
console.log(failures ? `\n${failures} failing trial(s)` : "\nall trials pass");
process.exit(failures ? 1 : 0);
