import OpenAI from "openai";

let _openai;

function getOpenAI() {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

export default getOpenAI;

export async function generateReply(systemPrompt, messages) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ],
    max_tokens: 500,
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

export async function generateScript(offer, targetCustomer, objections) {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a sales script expert. Generate a conversational DM script for Instagram that qualifies leads and books sales calls. The script should be natural, friendly, and not salesy. Return a JSON object with these fields:
- greeting: string (first message when someone DMs)
- qualifying_questions: string[] (2-3 questions to qualify the lead)
- interest_response: string (what to say when they show interest)
- objection_handlers: object (key: objection, value: response)
- booking_message: string (message with the booking link placeholder {{BOOKING_LINK}})
- not_a_fit_message: string (polite decline message)`,
      },
      {
        role: "user",
        content: `Create a DM sales script for:
Offer: ${offer}
Target Customer: ${targetCustomer}
Common Objections: ${objections}`,
      },
    ],
    max_tokens: 1500,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  return JSON.parse(response.choices[0].message.content);
}
