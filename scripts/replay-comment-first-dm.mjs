#!/usr/bin/env node
//
// scripts/replay-comment-first-dm.mjs
//
// Live check for the AI-written first comment DM on managed accounts
// (src/lib/comment-contextual-reply.js): real Sonnet replies to sample
// comments on a clinic account, then the same first-message disclosure the
// pipeline prepends. Checks each final DM:
//
//   intro     — starts with the clinic's AI concierge line, once
//   on-topic  — names the treatment the comment asked about, or quotes its
//               price from the knowledge
//   grounded  — quotes the knowledge price when asked "how much"; no
//               invented prices
//   format    — passed the pre-send lint (no em dashes, no placeholders)
//
// No DB access (an in-memory stand-in holds the account and knowledge).
// 2 samples × 2 comments = 4 Sonnet calls per run.
//
// Usage:
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/replay-comment-first-dm.mjs [--samples=2]

import { generateCommentReply } from "../src/lib/comment-contextual-reply.js";
import { applyDisclosure, disclosureLine } from "../src/lib/persona-disclosure.js";
import { fakeDb } from "../src/lib/test-utils/fake-db.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);
const SAMPLES = Number(args.samples || 2);

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
const KNOWLEDGE = [
  { id: "k1", user_id: "u1", enabled: true, sort: 0, type: "faq", question: "How much is Botox?", answer: "$12 per unit. Most first visits are 20 to 40 units." },
  { id: "k2", user_id: "u1", enabled: true, sort: 1, type: "faq", question: "How much is lip filler?", answer: "$650 per syringe." },
  { id: "k3", user_id: "u1", enabled: true, sort: 2, type: "policy", question: "Grand opening deal", answer: "10% off any treatment booked in October." },
];
const INTRO = disclosureLine(USER);

const CASES = [
  {
    name: "botox, how much",
    caption: "Grand Opening.. Comment Botox for 10% off",
    comment: "Girllll, i would love some botox? how much?",
    treatment: /botox/i,
    price: /\$12/,
  },
  {
    name: "lip filler deal",
    caption: "Grand Opening! 10% off all treatments this October",
    comment: "hey would love 10% on some lip filler, any deals?",
    treatment: /lip filler|filler/i,
    price: null,
  },
];

const db = fakeDb({ users: [USER], knowledge_entries: KNOWLEDGE, creator_offers: [], messages: [] });

let failures = 0;
for (const c of CASES) {
  for (let i = 1; i <= SAMPLES; i++) {
    const gen = await generateCommentReply(db, { userId: "u1", conversation: null, caption: c.caption, commentText: c.comment });
    if (gen.kind !== "reply") {
      failures++;
      console.log(`✗ ${c.name} #${i}: ${gen.kind} ${gen.reason || gen.category || ""}`);
      continue;
    }
    const dm = applyDisclosure(gen.text, INTRO);
    const checks = {
      intro: dm.startsWith(INTRO) && dm.split(INTRO).length === 2,
      // Names the treatment, or answers with its own price from the knowledge.
      "on-topic": c.treatment.test(dm) || Boolean(c.price && c.price.test(dm)),
      grounded: c.price ? c.price.test(dm) : !/\$\d/.test(dm) || /\$650|\$12/.test(dm),
      format: !/[—–]/.test(dm) && !/\{\{/.test(dm),
    };
    const bad = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (bad.length) failures++;
    console.log(`${bad.length ? "✗" : "✓"} ${c.name} #${i}${bad.length ? ` (failed: ${bad.join(", ")})` : ""}\n  comment: ${c.comment}\n  DM:      ${dm}\n`);
  }
}
console.log(failures ? `${failures} failing sample(s)` : "all samples pass");
process.exit(failures ? 1 : 0);
