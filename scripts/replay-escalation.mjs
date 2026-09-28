#!/usr/bin/env node
//
// scripts/replay-escalation.mjs
//
// Live check for the human-in-loop escalation classifier
// (classifyIncomingMessage in src/lib/anthropic.js). Scores hand-written
// cases, 2 samples each, against whether a human should take over.
//
// Since PR A, hostility/refund/legal/crisis belong to the DM intent
// classifier's do_not_send, and personal/off-topic chat to not_a_lead. The
// gate applies those before escalation, so for those cases either answer is
// accepted here ("either"). See audits/dm-classifier-prompt-audit-2026-09-28.md
// §4 and PR C.
//
// No DB access. ~50 Haiku calls per run (a few cents).
//
// Usage:
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/replay-escalation.mjs [--samples=2] [--strict]

import { classifyIncomingMessage } from "../src/lib/anthropic.js";

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

const sc = {
  offer: "12-week 1:1 strength coaching for busy parents, $300",
  targetCustomer: "parents 30-50 who want to get strong",
};
const lead = (content) => ({ role: "user", source: "lead", content });
const ai = (content) => ({ role: "assistant", source: "agent", content });
const opener = [ai("hey! what's your training situation like right now?")];

// want: true = a human must take over, false = the AI should handle it,
// "either" = another gate owns this case.
const cases = [
  { name: "asks for the owner directly", msg: "can I just talk to Dom directly please", want: true },
  { name: "wants a real person", msg: "I'd rather speak with an actual human about this", want: true },
  { name: "medical safety", msg: "I have a herniated disc from last year, is this safe for me to do?", want: true },
  { name: "pregnancy", msg: "I'm 5 months pregnant, can I still join?", want: true },
  { name: "discount deal", msg: "would you do 50% off if I refer 3 friends?", want: true },
  { name: "partnership offer", msg: "what if instead of paying I promote you to my 40k followers?", want: true },
  { name: "financial distress", msg: "I just lost my job and I'm behind on rent but I really need this", want: true },
  { name: "4-part question", msg: "how much is it, is there a payment plan, can my husband join on the same spot, and what's your refund policy?", want: true },
  { name: "price question", msg: "how much is it?", want: false },
  { name: "price objection", msg: "that's a lot, I can't really afford $300 right now", want: false },
  { name: "time objection", msg: "not right now, maybe in january", want: false },
  { name: "wants proof", msg: "do you have results from other parents?", want: false },
  { name: "booking", msg: "ok I'm in, send me the link", want: false },
  { name: "qualifying answer", msg: "I lift maybe twice a week but I keep falling off", want: false },
  { name: "two simple asks", msg: "how long are the sessions and are they online?", want: false },
  { name: "is this a bot", msg: "wait is this a bot?", want: false },
  { name: "vague greeting", msg: "hey", want: false },
  { name: "hostile refund (do_not_send owns)", msg: "this is a scam, refund me or I'm calling my bank", want: "either" },
  { name: "personal (not_a_lead owns)", msg: "happy birthday!! we need to celebrate this weekend", want: "either" },
];

async function run(c, sample) {
  try {
    const r = await classifyIncomingMessage(c.msg, [...opener, lead(c.msg)], sc);
    return { ...c, sample, got: r.needs_human === true, reason: r.reason, category: r.category };
  } catch (err) {
    return { ...c, sample, got: null, reason: err.message };
  }
}

const jobs = cases.flatMap((c) => Array.from({ length: SAMPLES }, (_, i) => () => run(c, i + 1)));
const out = [];
for (let i = 0; i < jobs.length; i += 4) out.push(...(await Promise.all(jobs.slice(i, i + 4).map((j) => j()))));

let tp = 0, fn = 0, fp = 0, tn = 0, errors = 0;
for (const r of out) {
  if (r.got === null) errors++;
  else if (r.want === true) r.got ? tp++ : fn++;
  else if (r.want === false) r.got ? fp++ : tn++;
  const ok = r.got !== null && (r.want === "either" || r.got === r.want);
  console.log(
    `${ok ? "ok  " : "MISS"} ${r.name.padEnd(36)} #${r.sample} needs_human=${String(r.got).padEnd(5)} ${r.category ? `[${r.category}] ` : ""}${(r.reason || "").slice(0, 90)}`
  );
}
console.log(`\nshould escalate: ${tp}/${tp + fn} caught · should NOT escalate: ${fp} false escalations of ${fp + tn} · errors: ${errors}`);
if (args.strict && (fn || fp || errors)) process.exitCode = 1;
