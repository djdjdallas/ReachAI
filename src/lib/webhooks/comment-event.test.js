import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

// Comment-to-DM dispatch: the first-message AI disclosure on the opener.
// Classifier, Meta and the trigger rules are mocked; the DB is in memory.

let db;
const sendPrivateReplyToComment = vi.fn(async () => ({ success: true, messageId: "mid-opener" }));
const decideAction = vi.fn(() => ({ action: "dm", rendered: "Hey! Thanks for commenting. First time trying Botox?" }));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/classifier", () => ({
  classifyComment: vi.fn(async () => ({ classification: { class: "HIGH_INTENT", confidence: 0.95, signals: [] }, raw: {}, latencyMs: 1 })),
  CLASSIFIER_MODEL: "test",
  CLASSIFIER_VERSION: "test",
}));
vi.mock("@/lib/contextBundle", () => ({ buildContextBundle: vi.fn(async () => ({ bundle: { id: "b1" }, offerSnapshot: null })) }));
vi.mock("@/lib/comment-trigger-rules", () => ({ decideAction }));
vi.mock("@/lib/instagram", () => ({ sendPrivateReplyToComment }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "page-token" }));
vi.mock("@/lib/comment-to-dm-gate", () => ({ canUseCommentToDM: () => true }));
vi.mock("@/lib/comment-public-reply", () => ({ maybePostPublicReply: vi.fn(async () => {}) }));

const { handleCommentEvent } = await import("./comment-event");

const IGBA = "17841400000000001";
const LEAD = "commenter-igsid";
const LINE = "Hi! I'm Katlynne, Solé Aesthetics' AI concierge.";

function setup(userOverrides = {}, extra = {}) {
  db = fakeDb(
    {
      users: [
        {
          id: "u1",
          email: "clinic@example.com",
          instagram_business_account_id: IGBA,
          meta_page_access_token: "enc",
          comment_public_reply_enabled: false,
          plan: "unlimited",
          billing_managed: true,
          business_name: "Solé Aesthetics",
          assistant_name: "Katlynne",
          ...userOverrides,
        },
      ],
      posts: [{ id: "p1", caption: "Botox special", ig_media_id: "media-1" }],
      post_monitoring_settings: [{ creator_id: "u1", post_id: "p1", enabled: true, actions_per_class: {} }],
      comment_classifications: [],
      dm_templates: [],
      creator_offers: [],
      comment_to_dm_log: [],
      conversations: extra.conversations || [],
      messages: extra.messages || [],
      outbound_webhooks: [],
    },
    { unique: { conversations: "instagram_sender_id" } }
  );
  db.rpc = async () => ({ data: true, error: null });
}

const comment = (id = "c-1") => [
  { id: IGBA },
  { field: "comments", value: { id, text: "BOTOX", media: { id: "media-1" }, from: { id: LEAD, username: "jane" }, created_time: new Date().toISOString() } },
];

beforeEach(() => vi.clearAllMocks());

describe("comment-to-DM opener: first-message AI disclosure", () => {
  it("a new lead's opener gets the disclosure and loses the template's greeting", async () => {
    setup();
    await handleCommentEvent(...comment());
    const sent = sendPrivateReplyToComment.mock.calls[0][2];
    expect(sent).toBe(`${LINE} Thanks for commenting. First time trying Botox?`);
    // Saved as sent: the AI sees exactly this opener as history.
    expect(db.tables.messages[0]).toMatchObject({ role: "assistant", source: "agent", content: sent, provider_message_id: "mid-opener" });
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ dispatched: true, rendered_dm: sent });
    // The new thread is created already claimed.
    expect(db.tables.conversations[0]).toMatchObject({ origin: "clinchd_sent", disclosed_at: expect.any(String) });
  });

  it("a lead whose thread is already claimed gets the template as-is", async () => {
    setup({}, {
      conversations: [{ id: "conv-1", user_id: "u1", instagram_sender_id: LEAD, origin: "inbound", disclosed_at: "2026-10-06T10:00:00.000Z" }],
    });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Hey! Thanks for commenting. First time trying Botox?");
  });

  it("an open but unclaimed thread is claimed atomically before the send", async () => {
    setup({}, {
      conversations: [{ id: "conv-1", user_id: "u1", instagram_sender_id: LEAD, origin: "inbound", disclosed_at: null }],
    });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Thanks for commenting. First time trying Botox?`);
    expect(db.tables.conversations[0].disclosed_at).toEqual(expect.any(String));
  });

  it("a failed send releases the claim", async () => {
    setup({}, {
      conversations: [{ id: "conv-1", user_id: "u1", instagram_sender_id: LEAD, origin: "inbound", disclosed_at: null }],
    });
    sendPrivateReplyToComment.mockResolvedValueOnce({ success: false, error: "meta_error", retryable: true });
    await handleCommentEvent(...comment());
    expect(db.tables.conversations[0].disclosed_at).toBeNull();
  });

  it("a failed send to a brand-new lead leaves no thread behind", async () => {
    setup();
    sendPrivateReplyToComment.mockResolvedValueOnce({ success: false, error: "meta_error", retryable: true });
    await handleCommentEvent(...comment());
    expect(db.tables.conversations).toHaveLength(0);
  });

  it("coach accounts send the template unchanged", async () => {
    setup({ business_name: null });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Hey! Thanks for commenting. First time trying Botox?");
  });

  it("Meta's echo won the race: the opener and its new thread are relabeled as app-sent", async () => {
    // The echo handler already created the thread (native_send) and saved
    // the opener as a staff message with the same Meta id.
    setup({}, {
      conversations: [{ id: "conv-e", user_id: "u1", instagram_sender_id: LEAD, origin: "native_send", missing_outbound_context: false }],
      messages: [{ id: "m-echo", conversation_id: "conv-e", role: "assistant", source: "manual", provider_message_id: "mid-opener", content: "(echo)" }],
    });
    await handleCommentEvent(...comment());
    expect(db.tables.messages).toHaveLength(1);
    expect(db.tables.messages[0].source).toBe("agent");
    expect(db.tables.conversations[0].origin).toBe("clinchd_sent");
    // The echo-created thread had no claim: the disclosed opener is recorded.
    expect(db.tables.conversations[0].disclosed_at).toEqual(expect.any(String));
  });

  it("a real cold-DM thread the clinic started by hand is not relabeled", async () => {
    setup({}, {
      conversations: [{ id: "conv-c", user_id: "u1", instagram_sender_id: LEAD, origin: "native_send" }],
      messages: [
        { id: "m-cold", conversation_id: "conv-c", role: "assistant", source: "manual", provider_message_id: "cold-1", content: "hi from the clinic" },
        { id: "m-echo", conversation_id: "conv-c", role: "assistant", source: "manual", provider_message_id: "mid-opener", content: "(echo)" },
      ],
    });
    await handleCommentEvent(...comment());
    expect(db.tables.conversations[0].origin).toBe("native_send");
    expect(db.tables.messages.find((m) => m.id === "m-echo").source).toBe("agent");
  });
});
