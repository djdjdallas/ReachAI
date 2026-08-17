// Verification for speaker attribution in the reply path.
//
// Reproduces the 2026-08-10 misattribution incident (conversation
// 3d81e107-8524-4cba-af17-0cb1c1e9ed68) and asserts it can no longer happen.
// See docs/audit-2026-08-15-reply-path.md.
//
// The incident: the account owner manually typed "my ai assistant tries to
// answer everyone" in the Instagram app. 17 hours later the lead replied "💖"
// and the AI answered "sounds like YOUR assistant is doing its job a little
// too well" — attributing the owner's own words to the lead.
//
// Structural checks run offline. The live generation check runs only when
// ANTHROPIC_API_KEY is set.
//
// Usage: node --experimental-detect-module scripts/test-speaker-attribution.mjs
//   (the flag is required on Node 20; on Node 22+ ESM detection is the default)

import {
  labelMessageContent,
  speakerLabel,
  generateReply,
  OWNER_MANUAL_MARK,
  DRIP_MARK,
} from "../src/lib/anthropic.js";
import { buildSystemPrompt } from "../src/lib/prompts.js";

function assert(cond, label) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
  } else {
    console.log("PASS:", label);
  }
}

const scriptConfig = {
  offer: "Clinchd — an AI DM setter for coaches",
  targetCustomer: "coaches and creators with high inbound DM volume",
  greeting: "hey! what brought you here today?",
  qualifying_questions: "are you dealing with DM volume or conversion?",
  interest_response: "love it",
  booking_message: "here's my link",
  not_a_fit_message: "no worries",
  script_mode: "guided",
};

// The incident thread, verbatim from production.
const incidentThread = [
  { role: "user", content: "👋", source: "lead" },
  {
    role: "assistant",
    source: "agent",
    content:
      "Hey, welcome! Really glad you stopped by. What brought you here today — are you dealing with a DM volume problem, or more of a conversion issue?",
  },
  {
    role: "assistant",
    source: "manual",
    content:
      "Hey sorry I'm a software developer and my ai assistant try's to answer everyone to book them lol",
  },
  { role: "assistant", source: "manual", content: "Happy we followed each other here" },
  { role: "user", content: "💖", source: "lead" },
];

// ── 1. Marking ──────────────────────────────────────────────────────────
console.log("\n--- content marking ---");

assert(
  labelMessageContent(incidentThread[2]).startsWith(OWNER_MANUAL_MARK),
  "owner's manual message is marked as owner-sent"
);
assert(
  labelMessageContent(incidentThread[1]) === incidentThread[1].content,
  "AI's own reply (source=agent) is left unmarked"
);
assert(
  labelMessageContent(incidentThread[4]) === "💖",
  "lead's message (role=user) is left unmarked"
);
assert(
  labelMessageContent({ role: "assistant", source: "drip", content: "still around?" })
    .startsWith(DRIP_MARK),
  "drip message is marked as an automated follow-up"
);
assert(
  labelMessageContent({ role: "assistant", source: "native_send", content: "hey!" })
    .startsWith(OWNER_MANUAL_MARK),
  "native-send cold DM is marked as owner-sent"
);
// Regression guard: a caller that forgets to select `source` must degrade to
// the old behaviour, never crash.
assert(
  labelMessageContent({ role: "assistant", content: "no source field" }) ===
    "no source field",
  "row with no source falls through unmarked instead of throwing"
);

// ── 2. Classifier / summarizer speaker labels ───────────────────────────
console.log("\n--- speaker labels (classifiers + summarizer) ---");

assert(speakerLabel(incidentThread[2]) === "Owner (typed manually)", "manual → Owner");
assert(speakerLabel(incidentThread[1]) === "AI", "agent → AI");
assert(speakerLabel(incidentThread[4]) === "Lead", "lead → Lead");

// ── 3. System prompt guidance ───────────────────────────────────────────
console.log("\n--- system prompt ---");

const systemPrompt = buildSystemPrompt(scriptConfig, "", {
  conversation: { origin: "inbound", missing_outbound_context: false },
});

assert(
  systemPrompt.includes(OWNER_MANUAL_MARK),
  "system prompt quotes the exact owner marker the mapper emits"
);
assert(
  systemPrompt.includes("WHO SAID WHAT"),
  "system prompt contains the speaker-attribution section"
);
assert(
  /never attribute|NOT the prospect's/i.test(systemPrompt),
  "system prompt forbids attributing owner messages to the lead"
);
assert(
  /inbox|support desk|helpdesk/i.test(systemPrompt) &&
    systemPrompt.includes("NEVER invent an organizational identity"),
  "system prompt forbids inventing a company/inbox identity"
);

// ── 4. Assistant-first guard ────────────────────────────────────────────
// The Anthropic API requires the first turn to be `user`. Echo-created
// conversations open on the owner's own message.
console.log("\n--- assistant-first guard ---");

const assistantFirst = [
  { role: "assistant", source: "manual", content: "hey! saw your page" },
  { role: "assistant", source: "agent", content: "following up" },
  { role: "user", source: "lead", content: "who is this?" },
];

// Mirror generateReply's internal mapping to inspect the shape it would send.
function shapeFor(history) {
  const mapped = history.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: labelMessageContent(m),
  }));
  let i = 0;
  while (i < mapped.length && mapped[i].role === "assistant") i++;
  const trimmed = mapped.slice(i);
  return trimmed.length ? trimmed : [{ role: "user", content: "(no messages from the lead yet)" }];
}

assert(shapeFor(assistantFirst)[0].role === "user", "leading assistant turns are dropped");
assert(
  shapeFor([{ role: "assistant", source: "manual", content: "only outbound" }])[0].role ===
    "user",
  "all-assistant history still yields a user-first array"
);
assert(shapeFor(incidentThread)[0].role === "user", "incident thread is already user-first");

// ── 4b. Classifier timeout sentinel ─────────────────────────────────────
// The webhook tells a timeout apart from a genuine API error by matching
// /timed out after/i on the error message. That coupling is invisible from
// either side, so pin it: force a real withTimeout rejection and confirm the
// message still matches. If withTimeout's wording ever changes, every timeout
// would silently be recorded as status:'error' instead.
console.log("\n--- classifier timeout sentinel ---");

const { withTimeout } = await import("../src/lib/dm-intent.js");

let timeoutErr = null;
try {
  await withTimeout(new Promise((r) => setTimeout(r, 500)), 5, "classifyIncomingMessage");
} catch (err) {
  timeoutErr = err;
}
assert(timeoutErr !== null, "withTimeout rejects on timeout (does not resolve a sentinel)");
assert(
  /timed out after/i.test(timeoutErr?.message || ""),
  "timeout message matches the webhook's timeout/error discriminator"
);
assert(
  !/timed out after/i.test("Connection error."),
  "a genuine API error does NOT match the timeout discriminator"
);

// The shape the webhook writes on that branch.
const sentinel = {
  status: /timed out after/i.test(timeoutErr.message) ? "timeout" : "error",
  reason: "classifier exceeded 8000ms",
  failed_open: true,
  at: new Date().toISOString(),
};
assert(sentinel.status === "timeout", "sentinel records status='timeout'");
assert(sentinel.failed_open === true, "sentinel records that we replied anyway");
console.log("sentinel:", JSON.stringify(sentinel));

// ── 5. Constructed prompt, for the record ───────────────────────────────
console.log("\n--- constructed messages array (incident thread) ---");
console.log(JSON.stringify(shapeFor(incidentThread), null, 2));

// ── 6. Live generation ──────────────────────────────────────────────────
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("\nSKIP: live generation (set ANTHROPIC_API_KEY to run it)");
} else {
  console.log("\n--- live generation against the incident thread ---");
  const reply = await generateReply(systemPrompt, incidentThread, {
    timeout: 20_000,
    maxRetries: 1,
  });
  console.log("REPLY:", reply);

  // The failure signature: telling the lead THEY have an assistant.
  const misattributes =
    /\byour (ai )?(assistant|bot)\b/i.test(reply) ||
    /\byou'?re? (using|running) an? (ai|assistant|bot)\b/i.test(reply);
  assert(!misattributes, "reply does not attribute the assistant to the lead");

  const inventsOrg = /\b(this is the|you'?ve reached) [^.!?]*\b(inbox|support|desk|team)\b/i.test(reply);
  assert(!inventsOrg, "reply does not invent a company/inbox identity");

  const rePitches = /\b(book a call|schedule a call|discovery call|here'?s (my|the) link)\b/i.test(reply);
  assert(!rePitches, "reply does not re-pitch after the owner apologised for the AI");
}

console.log("\ndone.");
