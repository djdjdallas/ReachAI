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
        max_tokens: 1500,
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
  }
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

export async function generateScript(offer, targetCustomer, objections, voiceProfile = null) {
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
` : `
WRITING RULES (apply to all fields):
- Sound like a real person texting on Instagram, not a corporate sales bot
- Use casual language: "yeah", "honestly", "for sure", "totally"
- Use contractions: "you're", "I'm", "that's", "it's"
- Keep messages short (2-3 sentences max per field except qualifying_questions)
- NO em dashes, NO semicolons, NO markdown, NO AI buzzwords like "absolutely", "certainly", "comprehensive"
- 1 emoji max, often 0 is better
`}
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
