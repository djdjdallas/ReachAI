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

export async function generateReply(systemPrompt, messages) {
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: sanitize(systemPrompt),
    messages: messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: sanitize(m.content),
    })),
  });

  return response.content[0].text;
}

export async function generateScript(offer, targetCustomer, objections) {
  const response = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: `You are a sales script expert writing DM scripts for Instagram coaches. Generate a conversational DM script that qualifies leads and books sales calls.

CRITICAL WRITING RULES — the script must sound like a real human texting:
- NEVER use em dashes (—). Use commas, periods, or "..." instead.
- NEVER use semicolons. Use short sentences.
- NEVER use words like "straightforward", "delve", "comprehensive", "leverage", "I hear you", "I totally get it".
- Use casual contractions: "you're", "it's", "that's", "don't", "can't", "won't".
- Keep sentences SHORT. Max 15 words per sentence. Real DMs are punchy.
- Use line breaks between thoughts, not long paragraphs.
- Max 1 emoji per message. Sometimes zero. Never multiple emojis in a row.
- Sound like a real person texting a friend, not a copywriter or AI.
- Vary sentence length. Mix 4-word sentences with 12-word ones.
- Use "haha", "lol", "honestly", "ngl", "tbh" sparingly but naturally.
- Avoid starting messages with "Hey [Name]!" every time. Mix it up.

Return ONLY a valid JSON object with these fields:
- greeting: string (first message when someone DMs)
- qualifying_questions: string[] (2-3 questions to qualify the lead)
- interest_response: string (what to say when they show interest)
- objection_handlers: object (key: objection keyword, value: response)
- booking_message: string (message with the booking link placeholder {{BOOKING_LINK}})
- not_a_fit_message: string (polite decline message)

Return ONLY the JSON object, no markdown fences or extra text.`,
    messages: [
      {
        role: "user",
        content: `Create a DM sales script for:
Offer: ${offer}
Target Customer: ${targetCustomer}
Common Objections: ${objections}`,
      },
    ],
  });

  let text = response.content[0].text.trim();
  // Strip markdown code fences if Claude wraps the JSON
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/,"");
  return JSON.parse(text);
}
