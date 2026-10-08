import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

// AI-written first DM, end to end with the real reply path: the comment
// pipeline, src/lib/comment-contextual-reply.js, the real prompt builder,
// linter and disclosure. Only the model, Meta and the classifier are
// mocked. What the model is given is asserted exactly; the model's reply
// is a fixed on-topic answer (the live replies are in
// scripts/replay-comment-first-dm.mjs).

let db;
const generateReply = vi.fn();
const sendPrivateReplyToComment = vi.fn(async () => ({ success: true, messageId: "mid-1" }));
const classifyComment = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/anthropic", async (importOriginal) => ({ ...(await importOriginal()), generateReply }));
vi.mock("@/lib/classifier", () => ({ classifyComment, CLASSIFIER_MODEL: "test", CLASSIFIER_VERSION: "test" }));
vi.mock("@/lib/contextBundle", () => ({ buildContextBundle: vi.fn(async () => ({ bundle: { id: "b1" }, offerSnapshot: null })) }));
vi.mock("@/lib/instagram", () => ({ sendPrivateReplyToComment, getOwnMedia: vi.fn(async () => null) }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "page-token" }));
vi.mock("@/lib/comment-to-dm-gate", () => ({ canUseCommentToDM: () => true }));
vi.mock("@/lib/comment-public-reply", () => ({ maybePostPublicReply: vi.fn(async () => {}) }));
vi.mock("@/lib/reply-grounding", () => ({
  loadReplyGrounding: vi.fn(async () => ({
    activeOffer: null,
    knowledge: [
      { id: "k1", enabled: true, sort: 0, type: "faq", question: "How much is Botox?", answer: "$12 per unit. Most first visits are 20 to 40 units." },
      { id: "k2", enabled: true, sort: 1, type: "faq", question: "How much is lip filler?", answer: "$650 per syringe." },
      { id: "k3", enabled: true, sort: 2, type: "policy", question: "Grand opening deal", answer: "10% off any treatment booked in October." },
    ],
  })),
}));

const { handleCommentEvent } = await import("./comment-event");

const IGBA = "17841400000000001";
const INTRO = "Hi! I'm Katlynne, Solé Aesthetics' AI concierge.";
const BOOKING = "https://book.sole.example/now";

function setup({ caption, treatmentKey = null }) {
  db = fakeDb(
    {
      users: [
        {
          id: "u1",
          email: "clinic@example.com",
          instagram_business_account_id: IGBA,
          meta_page_access_token: "enc",
          plan: "unlimited",
          billing_managed: true,
          business_name: "Solé Aesthetics",
          assistant_name: "Katlynne",
          booking_url: BOOKING,
          calendly_url: "https://calendly.com/sole/consult",
          script_config: { greeting: "Hi!", offer: "Botox, lip filler and facials" },
          treatment_categories: [
            { key: "botox", match: ["botox", "tox"], label: "Botox" },
            { key: "lip_filler", match: ["lip filler", "lips"], label: "lip filler" },
          ],
        },
      ],
      posts: [{ id: "p1", creator_id: "u1", caption, ig_media_id: "media-1" }],
      post_monitoring_settings: [{ creator_id: "u1", post_id: "p1", enabled: true, actions_per_class: null, treatment_key: treatmentKey }],
      comment_classifications: [],
      dm_templates: [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Book here: {{BOOKING_LINK}}" }],
      creator_offers: [],
      comment_to_dm_log: [],
      conversations: [],
      messages: [],
      outbound_webhooks: [{ id: "w1", user_id: "u1", enabled: true, event_types: ["lead_updated", "handoff_requested"] }],
      outbound_webhook_events: [],
      lead_profiles: [],
      dm_drip_queue: [],
    },
    { unique: { conversations: "instagram_sender_id", lead_profiles: "conversation_id", posts: "ig_media_id" } }
  );
  db.rpc = async () => ({ data: true, error: null });
}

const comment = (text) => [
  { id: IGBA },
  { field: "comments", value: { id: "c-1", text, media: { id: "media-1" }, from: { id: "lead-1", username: "jane" }, created_time: new Date().toISOString() } },
];

beforeEach(() => {
  vi.clearAllMocks();
  classifyComment.mockResolvedValue({ classification: { class: "HIGH_INTENT", confidence: 0.92, signals: [] }, raw: {}, latencyMs: 1 });
});

describe("AI-written first comment DM", () => {
  it('"Girllll, i would love some botox? how much?": the price from the knowledge, with the intro', async () => {
    setup({ caption: "Grand Opening.. Comment Botox for 10% off" });
    generateReply.mockResolvedValueOnce("Botox is $12 a unit, and most first visits are 20 to 40 units. You also get 10% off for our grand opening. Want the link to book?");
    await handleCommentEvent(...comment("Girllll, i would love some botox? how much?"));

    const [system, messages] = generateReply.mock.calls[0];
    // The comment is the lead's message, the caption its context. No history.
    expect(messages).toEqual([
      { role: "user", content: 'They commented on your post (caption: "Grand Opening.. Comment Botox for 10% off"): "Girllll, i would love some botox? how much?"' },
    ]);
    // The persona prompt with the knowledge, the booking link, the intro
    // rule and the no-availability rule.
    expect(system).toContain("$12 per unit");
    expect(system).toContain(BOOKING);
    expect(system).toContain(`"${INTRO}" is put in front of your reply automatically`);
    expect(system).toContain("Never say you'll check availability");

    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(
      `${INTRO} Botox is $12 a unit, and most first visits are 20 to 40 units. You also get 10% off for our grand opening. Want the link to book?`
    );
    // The new thread holds the sent reply, disclosed, and the lead is a Botox lead.
    expect(db.tables.conversations[0]).toMatchObject({ origin: "clinchd_sent", disclosed_at: expect.any(String) });
    expect(db.tables.messages[0]).toMatchObject({ role: "assistant", source: "agent", content: sendPrivateReplyToComment.mock.calls[0][2] });
    expect(db.tables.lead_profiles[0]).toMatchObject({ treatment_interest: "botox" });
  });

  it('"hey would love 10% on some lip filler, any deals?" on a deal post: on-topic, the intro, the booking link', async () => {
    setup({ caption: "Grand Opening! 10% off all treatments this October", treatmentKey: "botox" });
    generateReply.mockResolvedValueOnce(`Yes! Lip filler is $650 a syringe, and the 10% grand opening deal applies all October. Grab a spot here: ${BOOKING}`);
    await handleCommentEvent(...comment("hey would love 10% on some lip filler, any deals?"));

    const [system, messages] = generateReply.mock.calls[0];
    expect(messages.at(-1).content).toBe(
      'They commented on your post (caption: "Grand Opening! 10% off all treatments this October"): "hey would love 10% on some lip filler, any deals?"'
    );
    expect(system).toContain("10% off any treatment booked in October");
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(
      `${INTRO} Yes! Lip filler is $650 a syringe, and the 10% grand opening deal applies all October. Grab a spot here: ${BOOKING}`
    );
    // The comment names lip filler: it beats the post's Botox tag.
    expect(db.tables.lead_profiles[0]).toMatchObject({ treatment_interest: "lip_filler" });
  });

  it("the model's own greeting is replaced by the intro, and the reply is linted (no em dash)", async () => {
    setup({ caption: "Grand Opening.. Comment Botox for 10% off" });
    generateReply.mockResolvedValueOnce("Hey! Botox is $12 a unit — want the link?");
    await handleCommentEvent(...comment("botox price?"));
    const sentText = sendPrivateReplyToComment.mock.calls[0][2];
    expect(sentText.startsWith(`${INTRO} Botox is $12 a unit`)).toBe(true);
    expect(sentText).not.toContain("—");
  });

  it("a blocked reply falls back to the template", async () => {
    setup({ caption: "Grand Opening.. Comment Botox for 10% off" });
    generateReply.mockResolvedValueOnce("Hi {{FIRST_NAME}}, here's the deal");
    await handleCommentEvent(...comment("botox price?"));
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${INTRO} Book here: ${BOOKING}`);
  });
});
