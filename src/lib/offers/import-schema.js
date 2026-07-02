// Leaf module for the Import Offer feature: tool-use schema + constants only.
// MUST stay free of the Anthropic SDK (and any other server-only import) so
// it is safe to import from anywhere, including client components.

// ── Fetch / input constraints ──────────────────────────────────────────────

/** Max characters of page text sent to the extraction model. */
export const MAX_INPUT_CHARS = 30000;

/** Max response body size read from the coach's page (bytes). */
export const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB

/** Overall wall-clock budget for the page fetch, including redirects (ms). */
export const FETCH_TIMEOUT_MS = 8000;

/** Max redirects followed; each hop is re-validated. */
export const MAX_REDIRECTS = 3;

/** Only these content types are read; everything else is rejected unread. */
export const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain"];

// ── Rate limits (protect fetch + LLM cost) ─────────────────────────────────

export const MAX_IMPORTS_PER_DAY = 10;
export const MAX_IMPORTS_PER_HOUR = 5;

/** Endpoint label used with ai_call_log / check_ai_rate (migration 015). */
export const OFFER_IMPORT_RATE_ENDPOINT = "offer_import";

// ── Anthropic tool-use schema ──────────────────────────────────────────────
//
// Mirrors the forced-tool-use pattern in src/lib/dm-intent.js. The route
// forces this tool via tool_choice, then normalizes the input defensively.
//
// Note: `objections` and `qualification_questions` prefill form fields that
// are comma-separated, so item descriptions forbid internal commas (the
// route also strips them as a backstop).

export const OFFER_IMPORT_TOOL = {
  name: "record_offer_import",
  description:
    "Record the structured offer extracted from a coach's own sales/offer page. " +
    "You MUST call this tool exactly once. Only report facts present on the page; " +
    "never invent prices or claims that are not there.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      offer_name: {
        type: "string",
        description:
          "The name/title of the offer or program as marketed on the page (e.g. '6-Week Sprint Program'). Empty string if none is stated.",
      },
      price: {
        type: ["number", "null"],
        description:
          "The primary one-time price as a plain number (e.g. 497 for $497). If multiple tiers exist, use the main/most prominent one. null when no clear price is stated.",
      },
      currency: {
        type: ["string", "null"],
        description:
          "ISO 4217 currency code for the price, e.g. 'USD', 'EUR', 'GBP'. null when unknown or no price.",
      },
      promise: {
        type: "string",
        description:
          "The core outcome/transformation the offer promises, in one or two sentences. Empty string if unclear.",
      },
      target_audience: {
        type: "string",
        description:
          "Who the offer is for, in one or two sentences (e.g. 'Online fitness coaches doing $5-15k/month who want to scale'). Empty string if unclear.",
      },
      delivery_format: {
        type: ["string", "null"],
        description:
          "How the offer is delivered (e.g. '8-week group coaching program with weekly 1:1 calls and a community'). null if not stated.",
      },
      qualification_questions: {
        type: "array",
        items: { type: "string" },
        description:
          "3-5 short questions a human setter would ask in a DM to qualify a lead for THIS specific offer, grounded in the page (audience, situation, goals, budget-readiness). Do NOT use commas inside an individual question.",
      },
      faqs: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string", description: "The question." },
            a: {
              type: "string",
              description: "The answer, per the page. Keep it to 1-2 sentences.",
            },
          },
          required: ["q", "a"],
        },
        description:
          "Up to 5 FAQs taken from the page (or clearly implied by it). Empty array if none.",
      },
      objections: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 5 short likely lead objections (price, time, trust, fit) this page suggests, e.g. 'too expensive'. Do NOT use commas inside an individual item.",
      },
    },
    required: [
      "offer_name",
      "price",
      "currency",
      "promise",
      "target_audience",
      "delivery_format",
      "qualification_questions",
      "faqs",
      "objections",
    ],
  },
};
