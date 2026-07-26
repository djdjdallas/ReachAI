import Anthropic from "@anthropic-ai/sdk";
import { getPostHogClient } from "./posthog-server";

// ── Per-helper model overrides (kill switches) ─────────────────────────────
// classifyIncomingMessage and summarizeConversation were migrated from
// Sonnet 4.6 to Haiku 4.5 because they're high-volume structured-output
// calls. Set the env var below to claude-sonnet-4-6 to instantly revert
// without a code change (Vercel env var save + redeploy of the function).
// ALL OTHER call sites in this file remain on Sonnet 4.6 — see the audit
// in the comment-to-DM PR for the per-site rationale.
const CLASSIFY_INCOMING_MODEL =
  process.env.CLASSIFY_INCOMING_MODEL || "claude-haiku-4-5-20251001";
const SUMMARIZE_CONVERSATION_MODEL =
  process.env.SUMMARIZE_CONVERSATION_MODEL || "claude-haiku-4-5-20251001";

// Helper that fires a PostHog telemetry event without ever throwing into
// the caller — these helpers are called from webhook handlers where any
// crash would silently break user-facing flows.
function safePostHogCapture(distinctId, event, properties) {
  try {
    getPostHogClient().capture({ distinctId, event, properties });
  } catch (err) {
    console.error(`PostHog capture (${event}) failed:`, err.message);
  }
}

let _anthropic;

/**
 * Returns a singleton Anthropic SDK client.
 *
 * The classifier uses the default 5-minute ephemeral prompt cache (GA), which
 * works without any beta headers. An earlier attempt set the
 * `extended-cache-ttl-2025-04-11` beta header globally to enable `ttl: "1h"`
 * on cache_control blocks, but that path was unreliable with @anthropic-ai/sdk
 * 0.39.0 — caching never fired. The 5-minute TTL is sufficient because
 * comments on the same post arrive in rapid bursts.
 */
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
export async function generateReply(systemPrompt, messages, requestOptions = {}) {
  const response = await getAnthropic().messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      // 0.7 gives natural variation without going off-script
      temperature: 0.7,
      system: sanitize(systemPrompt),
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: sanitize(m.content),
      })),
    },
    // Default 30s + 1 retry (vs the SDK's 10-min timeout × 2 retries) so a
    // provider incident can't outlive a serverless caller's maxDuration.
    // Callers on a tighter wall-clock budget (the webhook) pass their own
    // requestOptions override.
    { timeout: 30_000, maxRetries: 1, ...requestOptions }
  );

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
/**
 * Analyzes sample messages to extract a coach's unique writing voice.
 *
 * @param {string[]} sampleMessages - 5-20 real messages/posts written by the coach
 * @returns {Promise<{voice_summary: string, voice_traits: object}>}
 */
export async function analyzeVoice(sampleMessages) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await getAnthropic().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        temperature: 0.3,
        system: `You are a linguistics and communication style expert. Analyze the writing samples provided and extract the author's unique voice characteristics.

CRITICAL: Return ONLY a valid JSON object. No markdown code fences. No preamble. No explanation.

The JSON must have exactly these fields:
- "voice_summary": string — A 2-3 sentence natural language description of how this person writes. Written as instructions for an AI to mimic (e.g., "Write in short, punchy sentences with high energy. Use slang like 'bro' and 'fire'. Rarely use periods, prefer exclamation marks.")
- "voice_traits": object with these keys:
  - "tone": string — overall emotional tone (e.g., "warm and encouraging", "direct and no-BS", "hype and energetic")
  - "formality": string — formality level (e.g., "very casual", "professional but approachable")
  - "sentence_length": string — typical sentence structure (e.g., "short and punchy, 3-8 words", "medium, conversational")
  - "emoji_usage": string — emoji habits (e.g., "heavy, uses fire/rocket/100 frequently", "minimal, occasional smiley", "none")
  - "punctuation_style": string — punctuation patterns (e.g., "lots of exclamation marks, skips periods", "proper punctuation", "ellipsis heavy")
  - "vocabulary": string — notable words/slang they use (e.g., "uses 'bro', 'honestly', 'let's go', 'crush it'")
  - "catchphrases": array of strings — recurring phrases (e.g., ["let's go", "that's fire", "no cap"])
  - "personality": string — overall vibe (e.g., "hype-man energy, like a supportive friend who's also a coach")
- "preview_replies": array of exactly 2 objects — sample DM replies written in this person's voice, to show them what the AI will sound like. Each object has:
  - "lead_message": string — a realistic incoming lead DM (e.g., "How much does this cost?")
  - "reply": string — a reply written in the analyzed voice (1-3 sentences, matching all traits above)
- "suggested_response_length": string — one of "short", "medium", or "long". Inferred from the average message length in the samples:
  - "short" if most messages are 1-2 sentences
  - "medium" if most messages are 2-4 sentences
  - "long" if most messages are 4+ sentences

EXAMPLE OUTPUT:
{
  "voice_summary": "Write in short, high-energy sentences. Use casual slang like 'bro' and 'let's go'. Heavy on exclamation marks, light on periods. Drop in a fire emoji occasionally. Sound like an excited friend who genuinely wants to help.",
  "voice_traits": {
    "tone": "hype and encouraging",
    "formality": "very casual, bro-talk",
    "sentence_length": "short and punchy, 3-8 words typical",
    "emoji_usage": "moderate, favors fire and 100 emoji",
    "punctuation_style": "heavy exclamation marks, rarely uses periods",
    "vocabulary": "uses 'bro', 'fire', 'crush it', 'let's go', 'no cap'",
    "catchphrases": ["let's go", "that's fire", "you got this"],
    "personality": "hype-man energy, supportive friend who's also a coach"
  },
  "preview_replies": [
    {"lead_message": "How much does this cost?", "reply": "yo good question! it's super affordable honestly, let me break it down for you real quick"},
    {"lead_message": "How does this work?", "reply": "bro it's so simple! basically I handle everything for you, you just show up and crush it"}
  ],
  "suggested_response_length": "short"
}`,
        messages: [
          {
            role: "user",
            content: `Analyze the writing voice in these ${sampleMessages.length} messages:\n\n${sampleMessages.map((m, i) => `[${i + 1}] ${m}`).join("\n\n")}`,
          },
        ],
      });

      const raw = response.content[0].text.trim();
      const parsed = extractAndParseJSON(raw);

      // Validate required fields exist
      if (!parsed.voice_summary || !parsed.voice_traits) {
        throw new Error("Missing voice_summary or voice_traits in response");
      }

      return parsed;
    } catch (err) {
      if (attempt === 2) {
        console.error("analyzeVoice failed after 2 attempts:", err.message);
        throw new Error("Failed to analyze voice. Please try again.");
      }
      console.warn(`analyzeVoice attempt ${attempt} failed, retrying...`, err.message);
    }
  }
}

/**
 * Summarizes a DM conversation and classifies the lead temperature.
 *
 * @param {Array} messages - Array of { role, content } objects
 * @returns {Promise<{summary: string, temperature: string}>}
 */
export async function summarizeConversation(messages) {
  const model = SUMMARIZE_CONVERSATION_MODEL;
  const startedAt = Date.now();
  const response = await getAnthropic().messages.create({
    model,
    max_tokens: 300,
    temperature: 0.3,
    system: `You are a sales conversation analyst. Analyze the DM conversation and return a JSON object with exactly these fields:

- "summary": A 1-2 sentence summary of where the conversation stands. Be specific about what was discussed and what the prospect's situation is.
- "temperature": One of "hot", "warm", or "cold":
  - "hot": Prospect is highly interested, asked about next steps, pricing, or booking. Ready to convert.
  - "warm": Prospect is engaged and asking questions but hasn't committed yet. Shows interest but has objections or needs more info.
  - "cold": Prospect is unresponsive, not a fit, showed little interest, or the conversation fizzled out.

CRITICAL: Return ONLY a valid JSON object. No markdown. No explanation. Just the raw JSON.

Example: {"summary": "Prospect runs a fitness coaching business doing $8k/month and is interested in scaling. Asked about pricing but concerned about the investment.", "temperature": "warm"}`,
    messages: [
      {
        role: "user",
        content: `Analyze this DM conversation:\n\n${messages.map((m) => `${m.role === "assistant" ? "AI" : "Lead"}: ${m.content}`).join("\n")}`,
      },
    ],
  });

  const latencyMs = Date.now() - startedAt;
  const usage = response?.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  const raw = response.content[0].text.trim();
  let result;
  try {
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : stripped);
    result = {
      summary: parsed.summary || "No summary available.",
      temperature: ["hot", "warm", "cold"].includes(parsed.temperature) ? parsed.temperature : "warm",
    };
  } catch {
    result = { summary: raw.slice(0, 200), temperature: "warm" };
  }

  console.info(
    "[summarizeConversation] model:",
    model,
    "tokens:",
    { in: inputTokens, out: outputTokens },
    "latency_ms:",
    latencyMs
  );

  safePostHogCapture("system_summarizer", "conversation_summarized", {
    model,
    temperature: result.temperature,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  return result;
}

/**
 * Generates a reply in the voice-chat interview flow.
 * The AI acts as a friendly interviewer eliciting the coach's natural writing style.
 *
 * @param {Array} messages - Conversation history [{role, content}]
 * @returns {Promise<string>}
 */
export async function generateVoiceChatReply(messages) {
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    temperature: 0.7,
    system: `You are a friendly voice coach helping a business owner capture their unique writing style. Your job is to ask them questions that make them respond naturally — the way they'd actually text a client or DM a lead.

RULES:
- Ask one question at a time
- Keep your questions short and casual
- Ask them to respond AS IF they were messaging a real person (not describing how they'd respond)
- Mix up the scenarios: greeting a new lead, handling an objection, following up, celebrating a win with a client
- After 4-5 exchanges, tell them you've got a great picture of their voice and they can click "Finish & Save"
- Do NOT analyze their voice in the chat — just be conversational and elicit natural responses
- Sound like a friendly person, not a corporate interviewer`,
    messages: messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: sanitize(m.content),
    })),
  });

  return response.content[0].text;
}

export async function generateScript(
  offer,
  targetCustomer,
  objections,
  voiceProfile = null,
  settings = null
) {
  const prompt = `Create a DM sales script for:
Offer: ${offer}
Target Customer: ${targetCustomer}
Common Objections: ${objections || "Not provided — generate sensible defaults based on the offer."}`;

  // Optional user preferences block — appended to the system prompt when provided.
  const toneMap = {
    professional: "polished and structured, avoid slang",
    friendly: "warm and conversational, like texting a friend",
    direct: "goal-oriented and assertive, get to the ask fast",
    supportive: "empathetic and patient, acknowledge concerns before redirecting",
  };
  const lengthMap = {
    short: "1-2 sentences per message",
    medium: "2-4 sentences per message",
    long: "up to 4-6 sentences per message when warranted",
  };
  let settingsBlock = "";
  const hasVoiceProfile = voiceProfile?.voice_summary;
  if (settings) {
    const lines = [];
    // Skip tone when a voice profile is active — it already defines tone
    if (!hasVoiceProfile && settings.tone && toneMap[settings.tone]) {
      lines.push(`- Tone: ${toneMap[settings.tone]}`);
    }
    const t = settings.traits || {};
    if (t.emojis === false) lines.push("- Do NOT use emojis anywhere in the script.");
    if (t.questions === true) lines.push("- End appropriate messages with a natural follow-up question.");
    if (t.humor === true) lines.push("- Light humor is welcome where it fits.");
    if (t.stories === true) lines.push("- Brief 1-sentence anecdotes are welcome where they fit.");
    if (settings.response_length && lengthMap[settings.response_length]) {
      lines.push(`- Length: ${lengthMap[settings.response_length]}`);
    }
    if (lines.length > 0) {
      settingsBlock = `\nUSER PREFERENCES — respect these alongside the writing rules:\n${lines.join("\n")}\n`;
    }
  }

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
${voiceProfile?.voice_summary ? `
VOICE & WRITING STYLE — the script MUST sound like this specific person:
${voiceProfile.voice_summary}

Specific traits to replicate:
- Tone: ${voiceProfile.voice_traits?.tone || "casual and friendly"}
- Formality: ${voiceProfile.voice_traits?.formality || "casual"}
- Sentence style: ${voiceProfile.voice_traits?.sentence_length || "short"}
- Emoji usage: ${voiceProfile.voice_traits?.emoji_usage || "minimal"}
- Punctuation: ${voiceProfile.voice_traits?.punctuation_style || "casual"}
- Vocabulary/slang: ${voiceProfile.voice_traits?.vocabulary || "casual language"}
- Catchphrases to use naturally: ${Array.isArray(voiceProfile.voice_traits?.catchphrases) ? voiceProfile.voice_traits.catchphrases.join(", ") : "none specified"}
- Personality: ${voiceProfile.voice_traits?.personality || "friendly and approachable"}
${settingsBlock}` : `
WRITING RULES (apply to all fields):
- Sound like a real person texting on Instagram, not a corporate sales bot
- Use casual language: "yeah", "honestly", "for sure", "totally"
- Use contractions: "you're", "I'm", "that's", "it's"
- Keep messages short (2-3 sentences max per field except qualifying_questions)
- NO em dashes, NO semicolons, NO markdown, NO AI buzzwords like "absolutely", "certainly", "comprehensive"
- 1 emoji max, often 0 is better
${settingsBlock}`}
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
 * Classifies an incoming Instagram DM as simple (AI can handle) or complex/uncertain
 * (a human should review before replying). Used by the human-in-loop feature.
 *
 * Fail-open by design: callers should treat any thrown error as "not complex".
 *
 * @param {string} incomingMessage - The user-facing text that just arrived
 * @param {Array}  recentMessages  - Last ~10 messages of the conversation [{role, content}]
 * @param {object} scriptConfig    - The coach's script_config (offer, target customer, etc.)
 * @returns {Promise<{needs_human: boolean, reason: string}>}
 */
export async function classifyIncomingMessage(incomingMessage, recentMessages = [], scriptConfig = {}) {
  const offer = scriptConfig.offer || "Not specified";
  const targetCustomer =
    scriptConfig.targetCustomer || scriptConfig.target_customer || "Not specified";

  const historyBlock = recentMessages
    .slice(-8)
    .map((m) => `${m.role === "assistant" ? "AI" : "Lead"}: ${m.content}`)
    .join("\n");

  const model = CLASSIFY_INCOMING_MODEL;
  const startedAt = Date.now();
  const response = await getAnthropic().messages.create({
    model,
    max_tokens: 150,
    // 0 (was 0.2 on Sonnet) — Haiku 4.5 handles structured triage best at
    // deterministic temperature; the prompt is rules-based, not creative.
    temperature: 0,
    system: `You are a triage classifier for a sales DM automation. Decide whether an incoming DM should be answered by the AI or escalated to the human business owner.

Return ONLY a valid JSON object. No markdown. No explanation. Format:
{"needs_human": boolean, "reason": "short 1-sentence explanation"}

Escalate (needs_human: true) when the incoming message is ANY of:
- A multi-part question with 3+ distinct asks in one message
- A high-stakes situation (legal, medical, refund dispute, financial distress, crisis)
- An unusual or novel objection the standard script clearly can't address
- Explicit request to speak to a human, owner, or real person
- Accusations or hostile messages
- Off-topic or confusing messages where the intent is unclear

Do NOT escalate (needs_human: false) for:
- Standard questions about pricing, program details, results, timing
- Common objections like "too expensive", "need to think", "not right now"
- Qualifying questions being answered
- Simple greetings or interest expressions
- Booking confirmations

Be conservative: when in doubt, do NOT escalate — false-escalations are worse than false-pass-throughs.`,
    messages: [
      {
        role: "user",
        content: `BUSINESS: ${offer}
TARGET CUSTOMER: ${targetCustomer}

RECENT CONVERSATION:
${historyBlock || "(no prior messages)"}

NEW INCOMING MESSAGE: ${incomingMessage}

Classify this message.`,
      },
    ],
    // Webhook-path call — same 30s/1-retry budget rationale as generateReply.
  }, { timeout: 30_000, maxRetries: 1 });

  const latencyMs = Date.now() - startedAt;
  const usage = response?.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;

  const raw = response.content[0].text.trim();
  const parsed = extractAndParseJSON(raw);
  const result = {
    needs_human: parsed.needs_human === true,
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };

  console.info(
    "[classifyIncomingMessage] model:",
    model,
    "tokens:",
    { in: inputTokens, out: outputTokens },
    "latency_ms:",
    latencyMs
  );

  safePostHogCapture("system_classifier", "classify_incoming_message", {
    model,
    needs_human: result.needs_human,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
  });

  return result;
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
