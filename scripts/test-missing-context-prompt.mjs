// Manual verification for the missing-outbound-context branch in prompts.js.
// Runs buildSystemPrompt under four scenarios and asserts the right block
// is or isn't present.
//
// Usage: node --experimental-detect-module scripts/test-missing-context-prompt.mjs
//   (the flag is required on Node 20; on Node 22+ ESM detection is the default)

import { buildSystemPrompt } from "../src/lib/prompts.js";

const baseScriptConfig = {
  offer: "12 week workout coaching",
  targetCustomer: "busy women 30-45",
  greeting: "hey thanks for the message",
  qualifying_questions: "what's your current routine?",
  interest_response: "love it",
  booking_message: "here's my link",
  not_a_fit_message: "no worries",
  script_mode: "guided",
};

const activeOffer = {
  offer_name: "12 week workout",
  ideal_customer: "busy women 30-45",
  objections: ["no time", "doesn't work"],
};

function assert(cond, label) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
  } else {
    console.log("PASS:", label);
  }
}

// Case 1: origin=clinchd_sent + missing_outbound_context=true → block present
const promptA = buildSystemPrompt(baseScriptConfig, "", {
  conversation: {
    id: "test-conv-1",
    user_id: "test-user-1",
    origin: "clinchd_sent",
    missing_outbound_context: true,
  },
  activeOffer,
});
assert(
  promptA.includes("OUTBOUND-INITIATED CONVERSATION"),
  "Case 1: injects missing-context block when flag=true"
);
assert(
  promptA.includes("12 week workout"),
  "Case 1: grounds reply in offer name"
);
assert(
  promptA.includes("busy women 30-45"),
  "Case 1: includes ideal customer"
);
assert(
  promptA.includes("no time; doesn't work"),
  "Case 1: serializes objections array"
);
assert(
  !promptA.includes("CONVERSATION ORIGIN — NATIVE SEND"),
  "Case 1: does NOT include native-send prefix (origin != native_send)"
);

// Case 2: origin=clinchd_sent + missing_outbound_context=false → no block
const promptB = buildSystemPrompt(baseScriptConfig, "", {
  conversation: {
    id: "test-conv-2",
    user_id: "test-user-1",
    origin: "clinchd_sent",
    missing_outbound_context: false,
  },
});
assert(
  !promptB.includes("OUTBOUND-INITIATED CONVERSATION"),
  "Case 2: does NOT inject block when missing_outbound_context=false"
);

// Case 3: origin=inbound (default) → no block, even if flag somehow true
const promptC = buildSystemPrompt(baseScriptConfig, "", {
  conversation: {
    id: "test-conv-3",
    user_id: "test-user-1",
    origin: "inbound",
    missing_outbound_context: true,
  },
});
assert(
  !promptC.includes("OUTBOUND-INITIATED CONVERSATION"),
  "Case 3: does NOT inject block when origin=inbound"
);

// Case 4: branch fires but no activeOffer supplied → block still appears,
// degrades gracefully to "the coach's offer" placeholder.
const promptD = buildSystemPrompt(baseScriptConfig, "", {
  conversation: {
    id: "test-conv-4",
    user_id: "test-user-1",
    origin: "clinchd_sent",
    missing_outbound_context: true,
  },
  // activeOffer omitted
});
assert(
  promptD.includes("OUTBOUND-INITIATED CONVERSATION"),
  "Case 4: branch still fires without activeOffer"
);
assert(
  promptD.includes("the coach's offer"),
  "Case 4: falls back to generic offer phrasing"
);

if (process.argv.includes("--show")) {
  console.log("\n--- Full prompt for Case 1 ---\n");
  console.log(promptA);
}
