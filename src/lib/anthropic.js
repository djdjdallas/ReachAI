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
    system: `You are a sales script expert. Generate a conversational DM script for Instagram that qualifies leads and books sales calls. The script should be natural, friendly, and not salesy. Return ONLY a valid JSON object with these fields:
- greeting: string (first message when someone DMs)
- qualifying_questions: string[] (2-3 questions to qualify the lead)
- interest_response: string (what to say when they show interest)
- objection_handlers: object (key: objection, value: response)
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
