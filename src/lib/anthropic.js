import Anthropic from "@anthropic-ai/sdk";

let _anthropic;

function getAnthropic() {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

export default getAnthropic;

// Remove unpaired surrogates that break JSON serialization
function sanitize(str) {
  if (typeof str !== "string") return str;
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}

/**
 * Generates a single AI reply for a DM conversation.
 * Used by the webhook, dashboard reply route, and playground.
 *
 * @param {string} systemPrompt - Built by buildSystemPrompt() from prompts.js
 * @param {Array}  messages     - Array of { role, content } objects (conversation history)
 * @returns {Promise<string>}
 */
export async function generateReply(systemPrompt, messages) {
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    // 0.7 gives natural variation without going off-script
    temperature: 0.7,
    system: sanitize(systemPrompt),
    messages: messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: sanitize(m.content),
    })),
  });

  return response.content[0].text;
}

/**
 * Generates a sales script JSON object from the user's offer details.
 *
 * Reliability features:
 * 1. temperature: 0.4 — reduces hallucination and JSON format deviation
 * 2. extractAndParseJSON() — extracts JSON from anywhere in the response
 * 3. Automatic retry — one retry before returning a user-friendly error
 * 4. Field validation — ensures all 6 required fields exist with defaults
 * 5. Field filtering — strips extra fields Claude might add
 * 6. Example JSON in the prompt — anchors output format strongly
 *
 * @param {string} offer          - Description of the product/service
 * @param {string} targetCustomer - Description of the ideal customer
 * @param {string} objections     - Common objections and how to handle them
 * @returns {Promise<object>}     - Validated script config object
 */
export async function generateScript(offer, targetCustomer, objections) {
  const prompt = `Create a DM sales script for:
Offer: ${offer}
Target Customer: ${targetCustomer}
Common Objections: ${objections || "Not provided — generate sensible defaults based on the offer."}`;

  // Attempt generation with one automatic retry on parse failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await getAnthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        temperature: 0.4,
        system: `You are a sales script expert. Generate a conversational DM script for Instagram that qualifies leads and books sales calls. The script should be natural, friendly, and not salesy.

CRITICAL: Return ONLY a valid JSON object. No markdown code fences. No preamble. No explanation. Just the raw JSON object starting with { and ending with }.

The JSON must have exactly these 6 fields:
- "greeting": string — the first message sent when someone DMs
- "qualifying_questions": string — 2-3 questions, one per line, to qualify the lead naturally
- "interest_response": string — what to say when they show interest
- "objection_handlers": string — format as "objection: response" pairs, one per line
- "booking_message": string — message with the booking link placeholder {{BOOKING_LINK}}
- "not_a_fit_message": string — polite decline message

WRITING RULES (apply to all fields):
- Sound like a real person texting on Instagram, not a corporate sales bot
- Use casual language: "yeah", "honestly", "for sure", "totally"
- Use contractions: "you're", "I'm", "that's", "it's"
- Keep messages short (2-3 sentences max per field except qualifying_questions)
- NO em dashes, NO semicolons, NO markdown, NO AI buzzwords like "absolutely", "certainly", "comprehensive"
- 1 emoji max, often 0 is better

EXAMPLE OUTPUT (follow this format exactly):
{
  "greeting": "hey! thanks for reaching out. what made you decide to message today?",
  "qualifying_questions": "what does your current situation look like with [relevant topic]?\\nwhat's your main goal right now?\\nhave you tried anything else to solve this before?",
  "interest_response": "yeah that makes total sense. sounds like you're in a good spot for this. want me to share how it works?",
  "objection_handlers": "too expensive: totally get that. a lot of people feel the same way before they see the results. what would make it feel worth it to you?\\nnot the right time: makes sense. when do you think you'd be ready to take action on this?",
  "booking_message": "awesome, let's get a quick call on the calendar so we can figure out if it's a fit. here's the link: {{BOOKING_LINK}}",
  "not_a_fit_message": "thanks for reaching out honestly! sounds like the timing might not be right, but I appreciate you taking the time"
}`,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = response.content[0].text.trim();
      const parsed = extractAndParseJSON(raw);
      return validateScriptFields(parsed);
    } catch (err) {
      if (attempt === 2) {
        console.error("generateScript failed after 2 attempts:", err.message);
        throw new Error("Failed to generate script. Please try again.");
      }
      console.warn(`generateScript attempt ${attempt} failed, retrying...`, err.message);
    }
  }
}

/**
 * Extracts a JSON object from a string that may contain extra text or markdown.
 *
 * Strategy:
 * 1. Try stripping common markdown fences first (fast path)
 * 2. Fall back to extracting the first { ... } block from anywhere in the string
 */
function extractAndParseJSON(text) {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(`No JSON object found in response. Raw: ${text.slice(0, 200)}`);
    }
    return JSON.parse(match[0]);
  }
}

/**
 * Validates that all 6 required script fields exist and are strings.
 * Fills in sensible defaults for any missing fields.
 * Strips extra fields Claude might have added.
 */
function validateScriptFields(parsed) {
  const defaults = {
    greeting: "hey! thanks for reaching out. what made you decide to message today?",
    qualifying_questions: "what does your current situation look like?\nwhat's your main goal right now?\nhave you tried anything else to solve this?",
    interest_response: "yeah that makes sense. sounds like you could be a good fit. want me to share how it works?",
    objection_handlers: "too expensive: totally understand. what would make it feel worth it to you?\nnot the right time: makes sense — when do you think you'd be ready?",
    booking_message: "awesome, let's get a quick call on the calendar. here's the link: {{BOOKING_LINK}}",
    not_a_fit_message: "thanks so much for reaching out! sounds like the timing might not be right, but I appreciate you connecting",
  };

  const result = {};
  for (const field of Object.keys(defaults)) {
    result[field] =
      typeof parsed[field] === "string" && parsed[field].trim()
        ? parsed[field].trim()
        : defaults[field];
  }

  return result;
}
