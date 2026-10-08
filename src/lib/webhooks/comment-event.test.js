import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

// Comment-to-DM dispatch: the first-message AI disclosure on the opener.
// Classifier, Meta and the trigger rules are mocked; the DB is in memory.

let db;
const sendPrivateReplyToComment = vi.fn(async () => ({ success: true, messageId: "mid-opener" }));
const decideAction = vi.fn(() => ({ action: "dm", rendered: "Hey! Thanks for commenting. First time trying Botox?" }));
const classifyComment = vi.fn(async () => ({ classification: { class: "HIGH_INTENT", confidence: 0.95, signals: [] }, raw: {}, latencyMs: 1 }));
const sendEmail = vi.fn(async () => {});
const generateCommentReply = vi.fn(async () => ({ kind: "reply", text: "Contextual reply." }));
const getOwnMedia = vi.fn(async () => ({ caption: "Botox special, comment BOTOX", permalink: "https://instagram.com/p/new", media_type: "IMAGE" }));

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/classifier", () => ({
  classifyComment,
  CLASSIFIER_MODEL: "test",
  CLASSIFIER_VERSION: "test",
}));
vi.mock("@/lib/contextBundle", () => ({ buildContextBundle: vi.fn(async () => ({ bundle: { id: "b1" }, offerSnapshot: null })) }));
vi.mock("@/lib/comment-trigger-rules", () => ({ decideAction }));
vi.mock("@/lib/instagram", () => ({ sendPrivateReplyToComment, getOwnMedia }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "page-token" }));
vi.mock("@/lib/comment-to-dm-gate", () => ({ canUseCommentToDM: () => true }));
vi.mock("@/lib/comment-public-reply", () => ({ maybePostPublicReply: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications", () => ({ sendEmail }));
vi.mock("@/lib/comment-contextual-reply", () => ({ generateCommentReply }));

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
          // Managed-account features (auto-watch, open-thread rules) are
          // opt-in per test.
          billing_managed: false,
          business_name: "Solé Aesthetics",
          assistant_name: "Katlynne",
          ...userOverrides,
        },
      ],
      posts: [{ id: "p1", creator_id: "u1", caption: "Botox special", ig_media_id: "media-1", permalink: "https://instagram.com/p/abc" }, ...(extra.posts || [])],
      post_monitoring_settings: extra.monitoringRows || [{ creator_id: "u1", post_id: "p1", enabled: true, actions_per_class: {}, ...extra.monitoring }],
      comment_classifications: [],
      dm_templates: extra.templates || [],
      creator_offers: [],
      comment_to_dm_log: [],
      conversations: extra.conversations || [],
      messages: extra.messages || [],
      outbound_webhooks: extra.webhooks || [],
      outbound_webhook_events: [],
      lead_profiles: [],
      dm_drip_queue: extra.drips || [],
      email_events: extra.emailEvents || [],
    },
    {
      unique: { conversations: "instagram_sender_id", lead_profiles: "conversation_id", posts: "ig_media_id" },
      failOn: extra.failOn,
      // Column defaults the pipeline relies on (the open-thread check reads
      // our messages' created_at).
      defaults: { messages: () => ({ created_at: new Date().toISOString() }) },
    }
  );
  db.rpc = async () => ({ data: true, error: null });
}

const comment = (id = "c-1", text = "BOTOX") => [
  { id: IGBA },
  { field: "comments", value: { id, text, media: { id: "media-1" }, from: { id: LEAD, username: "jane" }, created_time: new Date().toISOString() } },
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

// The real decision layer, for the tests below that exercise rendering and
// routing end to end.
const actual = await vi.importActual("@/lib/comment-trigger-rules");
const WEBHOOK = { id: "w1", user_id: "u1", enabled: true, event_types: ["handoff_requested", "lead_updated"] };
const TREATMENTS = [
  { key: "botox", match: ["botox"], label: "Botox" },
  { key: "lip_filler", match: ["lips", "lip filler"], label: "lip filler" },
];
const classifyAs = (cls, confidence = 0.95) =>
  classifyComment.mockResolvedValueOnce({ classification: { class: cls, confidence, signals: [] }, raw: {}, latencyMs: 1 });

describe("comment-to-DM: booking link", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Book here: {{BOOKING_LINK}}" }];

  it("renders booking_url when the account has one", async () => {
    setup({ business_name: null, booking_url: "https://book.sole.example/now", calendly_url: "https://calendly.com/sole/consult" }, { templates: tpl });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Book here: https://book.sole.example/now");
  });

  it("falls back to the Calendly link", async () => {
    setup({ business_name: null, booking_url: null, calendly_url: "https://calendly.com/sole/consult" }, { templates: tpl });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Book here: https://calendly.com/sole/consult");
  });
});

describe("comment-to-DM: per-post treatment", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Thanks for asking about {{TREATMENT|our services}}!" }];

  it("a tagged post renders the treatment label and seeds the lead's treatment", async () => {
    setup({ treatment_categories: TREATMENTS }, { templates: tpl, monitoring: { treatment_key: "lip_filler" }, webhooks: [WEBHOOK] });
    await handleCommentEvent(...comment("c-1", "how much??"));
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Thanks for asking about lip filler!`);
    expect(db.tables.lead_profiles[0]).toMatchObject({ conversation_id: db.tables.conversations[0].id, treatment_interest: "lip_filler" });
  });

  it("the post's tag wins over a treatment named in the comment", async () => {
    setup({ treatment_categories: TREATMENTS }, { templates: tpl, monitoring: { treatment_key: "lip_filler" }, webhooks: [WEBHOOK] });
    await handleCommentEvent(...comment("c-1", "is botox included?"));
    expect(db.tables.lead_profiles[0].treatment_interest).toBe("lip_filler");
  });

  it("an untagged post renders the template's fallback", async () => {
    setup({ treatment_categories: TREATMENTS }, { templates: tpl });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Thanks for asking about our services!`);
  });

  it("a tag the account no longer has is ignored", async () => {
    setup({ treatment_categories: TREATMENTS }, { templates: tpl, monitoring: { treatment_key: "laser" }, webhooks: [WEBHOOK] });
    await handleCommentEvent(...comment("c-1", "how much??"));
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Thanks for asking about our services!`);
    expect(db.tables.lead_profiles[0]?.treatment_interest ?? null).toBeNull();
  });

  it("coach accounts never enter the clinic module: the template renders as on main", async () => {
    setup({ business_name: null, treatment_categories: TREATMENTS }, { templates: tpl, monitoring: { treatment_key: "lip_filler" } });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Thanks for asking about {{TREATMENT|our services}}!");
  });
});

describe("comment-to-DM: clinic comments that need a person", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Grab a spot: {{BOOKING_LINK}}" }];

  it("a low-confidence inquiry: no DM, handoff_requested (other) as a comment-only lead, no email", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("HIGH_INTENT", 0.6);
    await handleCommentEvent(...comment("c-1", "hmm maybe"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    const classificationId = db.tables.comment_classifications[0].id;
    expect(db.tables.outbound_webhook_events).toEqual([
      expect.objectContaining({
        event_type: "handoff_requested",
        conversation_id: null,
        data: { reason: "other", comment_lead: { id: classificationId, instagram_username: "jane" } },
      }),
    ]);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review", dispatched: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("an UNCERTAIN comment is handed off", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "what lane?"));
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("a confident inquiry with no template is handed off rather than dropped", async () => {
    setup({}, { webhooks: [WEBHOOK] });
    classifyAs("HIGH_INTENT", 0.95);
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("a commenter with an open DM thread: the event is about that thread", async () => {
    setup({}, {
      templates: tpl,
      webhooks: [WEBHOOK],
      conversations: [{ id: "conv-1", user_id: "u1", instagram_sender_id: LEAD, origin: "inbound" }],
    });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "what lane?"));
    expect(db.tables.outbound_webhook_events[0]).toMatchObject({ conversation_id: "conv-1", data: { reason: "other" } });
  });

  it("a Meta re-delivery hands off once", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "what lane?"));
    await handleCommentEvent(...comment("c-1", "what lane?"));
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("praise is ignored: no DM, no handoff, even when the post is set to DM it", async () => {
    setup({}, {
      templates: [...tpl, { creator_id: "u1", intent_class: "ENGAGED_NOT_BUYING", template: "Thank you!! Book: {{BOOKING_LINK}}" }],
      webhooks: [WEBHOOK],
      monitoring: { actions_per_class: { ENGAGED_NOT_BUYING: "dm" } },
    });
    classifyAs("ENGAGED_NOT_BUYING", 0.95);
    await handleCommentEvent(...comment("c-1", "so pretty 😍🔥"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "ignore" });
  });

  it("praise on the default (queue_review) is ignored too", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("ENGAGED_NOT_BUYING", 0.95);
    await handleCommentEvent(...comment("c-1", "obsessed with this"));
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });

  it("ignored classes stay silent", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("SPAM", 0.99);
    await handleCommentEvent(...comment("c-1", "follow 4 follow"));
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });

  it("coach accounts keep the old silent queue", async () => {
    setup({ business_name: null }, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "what lane?"));
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });
});

describe("comment-to-DM: clinic complaints", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [
    { creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Grab a spot: {{BOOKING_LINK}}" },
    { creator_id: "u1", intent_class: "CRITICAL_NEGATIVE", template: "So sorry! Book a fix: {{BOOKING_LINK}}" },
  ];

  it("a complaint the classifier called HIGH_INTENT gets no sales DM; it is handed off", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("HIGH_INTENT", 0.95);
    await handleCommentEvent(...comment("c-1", "my lips are still lumpy, how do I fix this?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events[0]).toMatchObject({ event_type: "handoff_requested", data: { reason: "other" } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("CRITICAL_NEGATIVE set to DM on the post still gets no DM", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK], monitoring: { actions_per_class: { CRITICAL_NEGATIVE: "dm" } } });
    classifyAs("CRITICAL_NEGATIVE", 0.97);
    await handleCommentEvent(...comment("c-1", "this place is a scam"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("CRITICAL_NEGATIVE on the default (ignore) is handed off rather than dropped", async () => {
    setup({}, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("CRITICAL_NEGATIVE", 0.97);
    await handleCommentEvent(...comment("c-1", "I want a refund"));
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review" });
  });

  it("coach accounts: a CRITICAL_NEGATIVE set to DM still follows the post's setting", async () => {
    setup({ business_name: null }, { templates: tpl, monitoring: { actions_per_class: { CRITICAL_NEGATIVE: "dm" } } });
    classifyAs("CRITICAL_NEGATIVE", 0.97);
    await handleCommentEvent(...comment("c-1", "this place is a scam"));
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
  });
});

describe("comment-to-DM: ad comments", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey {{COMMENTER_NAME}}! Book: {{BOOKING_LINK}}" }];
  // The shape Meta sends for a comment on an ad or boosted post: media.id
  // is the ad's media; original_media_id is the organic post.
  const adComment = (originalMediaId = "media-1") => [
    { id: IGBA },
    {
      field: "comments",
      value: {
        id: "c-ad-1",
        text: "how much??",
        from: { id: LEAD, username: "jane" },
        media: { id: "ad-media-9", ad_id: "120200000000001", ad_title: "Botox October", original_media_id: originalMediaId, media_product_type: "AD" },
        created_time: new Date().toISOString(),
      },
    },
  ];

  it("a comment on an ad for a watched post is handled as that post's comment", async () => {
    setup({ business_name: null, calendly_url: "https://calendly.com/x" }, { templates: tpl });
    await handleCommentEvent(...adComment());
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(sendPrivateReplyToComment.mock.calls[0][1]).toBe("c-ad-1");
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Hey jane! Book: https://calendly.com/x");
    expect(db.tables.comment_classifications[0]).toMatchObject({ post_id: "p1", ig_comment_id: "c-ad-1" });
    // No stray posts row for the ad's own media.
    expect(db.tables.posts.map((p) => p.ig_media_id)).toEqual(["media-1"]);
  });

  it("an original_media_id that is another creator's post falls through to the ad's own media", async () => {
    setup({ business_name: null, billing_managed: false }, {
      templates: tpl,
      posts: [{ id: "p-foreign", creator_id: "someone-else", caption: "theirs", ig_media_id: "media-foreign" }],
    });
    await handleCommentEvent(...adComment("media-foreign"));
    // Not classified against the foreign post; the ad's media got its own
    // row (unwatched, so skipped).
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_classifications).toHaveLength(0);
    expect(db.tables.posts.find((p) => p.ig_media_id === "ad-media-9")).toMatchObject({ creator_id: "u1" });
  });

  it("an ad whose original post Clinchd doesn't know falls back to the ad's media (not watched: skipped)", async () => {
    setup({ business_name: null, billing_managed: false }, { templates: tpl });
    await handleCommentEvent(...adComment("media-unknown"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_classifications).toHaveLength(0);
    expect(db.tables.posts.map((p) => p.ig_media_id)).toEqual(["media-1", "ad-media-9"]);
  });
});

describe("comment-to-DM: deploy before migration 20261011120000", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  // PostgREST's answer to a select naming a column the table doesn't have.
  const noTreatmentColumn = {
    post_monitoring_settings: (st) =>
      st.op === "select" && /treatment_key/.test(st.cols || "")
        ? { code: "42703", message: "column post_monitoring_settings.treatment_key does not exist" }
        : null,
  };

  it("a coach comment still DMs when treatment_key doesn't exist yet", async () => {
    setup({ business_name: null, calendly_url: "https://calendly.com/x" }, {
      templates: [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Book: {{BOOKING_LINK}}" }],
      failOn: noTreatmentColumn,
    });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Book: https://calendly.com/x");
  });

  it("a clinic comment still DMs, rendered as untagged", async () => {
    setup({ treatment_categories: TREATMENTS }, {
      templates: [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Thanks for asking about {{TREATMENT|our services}}!" }],
      monitoring: { treatment_key: "lip_filler" },
      failOn: noTreatmentColumn,
    });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Thanks for asking about our services!`);
  });

  it("any other read error still skips (unchanged)", async () => {
    setup({ business_name: null }, {
      templates: [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Book" }],
      failOn: { post_monitoring_settings: { code: "57014", message: "statement timeout" } },
    });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
  });
});

describe("comment-to-DM: managed-account auto-watch", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Book: {{BOOKING_LINK}}" }];
  const COACH = { business_name: null, billing_managed: false, calendly_url: "https://calendly.com/x" };
  const MANAGED = { ...COACH, billing_managed: true };
  // A post Clinchd first sees through this comment.
  const onNewPost = (id = "c-1", text = "how much?") => {
    const [entry, change] = comment(id, text);
    return [entry, { ...change, value: { ...change.value, media: { id: "media-new" } } }];
  };
  const adComment = (media) => [
    { id: IGBA },
    { field: "comments", value: { id: "c-ad", text: "how much??", from: { id: LEAD, username: "jane" }, media, created_time: new Date().toISOString() } },
  ];
  const monitoring = () => db.tables.post_monitoring_settings;

  it("a comment on an unwatched post is handled with the defaults, and the post is watched from now on", async () => {
    setup(MANAGED, { templates: tpl, monitoringRows: [] });
    // Managed accounts get an AI-written DM; this test is about the
    // template, so generation fails and the template is the fallback.
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "test" });
    await handleCommentEvent(...onNewPost());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe("Hey! Book: https://calendly.com/x");
    const post = db.tables.posts.find((p) => p.ig_media_id === "media-new");
    expect(monitoring()).toEqual([expect.objectContaining({ creator_id: "u1", post_id: post.id, enabled: true, actions_per_class: null })]);
    // The caption came from Meta and grounded the classifier.
    expect(getOwnMedia).toHaveBeenCalledWith("media-new", "page-token", { igAccountId: IGBA, username: null });
    expect(post).toMatchObject({ caption: "Botox special, comment BOTOX", permalink: "https://instagram.com/p/new" });
    expect(classifyComment.mock.calls[0][0].postCaption).toBe("Botox special, comment BOTOX");
  });

  it("the second comment uses the row the first one created", async () => {
    setup(MANAGED, { templates: tpl, monitoringRows: [] });
    await handleCommentEvent(...onNewPost("c-1"));
    // A different commenter (the same one would now be awaiting a reply).
    const [entry, change] = onNewPost("c-2");
    await handleCommentEvent(entry, { ...change, value: { ...change.value, from: { id: "other-igsid", username: "kim" } } });
    expect(monitoring()).toHaveLength(1);
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(2);
    expect(getOwnMedia).toHaveBeenCalledTimes(1);
  });

  it("default actions per class: a praise comment is queued, not DM'd", async () => {
    setup(MANAGED, { templates: [...tpl, { creator_id: "u1", intent_class: "ENGAGED_NOT_BUYING", template: "thx" }], monitoringRows: [] });
    classifyAs("ENGAGED_NOT_BUYING", 0.95);
    await handleCommentEvent(...onNewPost("c-1", "love this"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review" });
  });

  it("a post the account turned off stays off", async () => {
    setup(MANAGED, { templates: tpl, monitoringRows: [{ creator_id: "u1", post_id: "p1", enabled: false, actions_per_class: null }] });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(monitoring()).toEqual([expect.objectContaining({ post_id: "p1", enabled: false })]);
    expect(getOwnMedia).not.toHaveBeenCalled();
  });

  it("Meta can't read the post: still watched, without a caption", async () => {
    setup(MANAGED, { templates: tpl, monitoringRows: [] });
    getOwnMedia.mockResolvedValueOnce(null);
    await handleCommentEvent(...onNewPost());
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(monitoring()).toHaveLength(1);
  });

  it("a post row that belongs to another creator is never auto-watched", async () => {
    setup(MANAGED, {
      templates: tpl,
      monitoringRows: [],
      posts: [{ id: "p-foreign", creator_id: "someone-else", caption: "theirs", ig_media_id: "media-foreign" }],
    });
    const [entry, change] = comment();
    await handleCommentEvent(entry, { ...change, value: { ...change.value, media: { id: "media-foreign" } } });
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(monitoring()).toHaveLength(0);
  });

  it("coach accounts unchanged: no row, no DM, nothing created, no Meta read", async () => {
    setup(COACH, { templates: tpl, monitoringRows: [] });
    await handleCommentEvent(...onNewPost());
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(monitoring()).toHaveLength(0);
    expect(getOwnMedia).not.toHaveBeenCalled();
    expect(db.tables.comment_classifications).toHaveLength(0);
  });

  it("clinic: an auto-watched post is untagged, so {{TREATMENT|fallback}} renders the fallback", async () => {
    setup({ billing_managed: true, treatment_categories: TREATMENTS }, {
      templates: [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Thanks for asking about {{TREATMENT|our services}}!" }],
      monitoringRows: [],
    });
    // Managed accounts get an AI-written DM; this test is about the
    // template, so generation fails and the template is the fallback.
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "test" });
    await handleCommentEvent(...onNewPost());
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Thanks for asking about our services!`);
    expect(monitoring()[0].treatment_key ?? null).toBeNull();
  });

  describe("ad comments", () => {
    it("an ad for an unwatched post the account owns: the organic post is auto-watched", async () => {
      setup(MANAGED, { templates: tpl, monitoringRows: [] });
      await handleCommentEvent(...adComment({ id: "ad-media-9", ad_id: "1202", original_media_id: "media-1" }));
      expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
      expect(monitoring()).toEqual([expect.objectContaining({ post_id: "p1", enabled: true })]);
      expect(db.tables.posts.map((p) => p.ig_media_id)).toEqual(["media-1"]);
    });

    it("an ad for a post Clinchd hasn't seen: ingested once Meta confirms it is the account's own, then watched", async () => {
      setup(MANAGED, { templates: tpl, monitoringRows: [] });
      await handleCommentEvent(...adComment({ id: "ad-media-9", ad_id: "1202", original_media_id: "media-organic" }));
      expect(getOwnMedia).toHaveBeenCalledWith("media-organic", "page-token", { igAccountId: IGBA, username: null });
      const post = db.tables.posts.find((p) => p.ig_media_id === "media-organic");
      expect(post).toMatchObject({ creator_id: "u1", caption: "Botox special, comment BOTOX" });
      expect(monitoring()).toEqual([expect.objectContaining({ post_id: post.id, enabled: true })]);
      expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
      // No row for the ad's own media.
      expect(db.tables.posts.some((p) => p.ig_media_id === "ad-media-9")).toBe(false);
    });

    it("an ad whose original Meta won't confirm as the account's: not auto-watched", async () => {
      setup(MANAGED, { templates: tpl, monitoringRows: [] });
      getOwnMedia.mockResolvedValueOnce(null);
      await handleCommentEvent(...adComment({ id: "ad-media-9", ad_id: "1202", original_media_id: "media-elsewhere" }));
      expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
      expect(monitoring()).toHaveLength(0);
    });

    it("an ad whose original is another creator's post: not auto-watched", async () => {
      setup(MANAGED, {
        templates: tpl,
        monitoringRows: [],
        posts: [{ id: "p-foreign", creator_id: "someone-else", caption: "theirs", ig_media_id: "media-foreign" }],
      });
      await handleCommentEvent(...adComment({ id: "ad-media-9", ad_id: "1202", original_media_id: "media-foreign" }));
      expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
      expect(monitoring()).toHaveLength(0);
    });

    it("a dynamic ad (no original_media_id): the ad's own media is never auto-watched", async () => {
      setup(MANAGED, { templates: tpl, monitoringRows: [] });
      await handleCommentEvent(...adComment({ id: "ad-media-9", ad_id: "1202" }));
      expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
      expect(monitoring()).toHaveLength(0);
    });

    it("coach accounts: an ad for an unwatched post is skipped as before", async () => {
      setup(COACH, { templates: tpl, monitoringRows: [] });
      await handleCommentEvent(...adComment({ id: "ad-media-9", ad_id: "1202", original_media_id: "media-organic" }));
      expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
      expect(getOwnMedia).not.toHaveBeenCalled();
      expect(db.tables.posts.some((p) => p.ig_media_id === "media-organic")).toBe(false);
    });
  });
});

describe("comment-to-DM: lead with an existing thread (managed accounts)", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const CAPTION = "Botox special";
  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Book: {{BOOKING_LINK}}" }];
  const MANAGED = { billing_managed: true, calendly_url: "https://calendly.com/x" };
  const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();
  const thread = (fields = {}) => ({ id: "conv-1", user_id: "u1", instagram_sender_id: LEAD, origin: "inbound", status: "interested", ai_paused: false, disclosed_at: "2026-10-01T00:00:00.000Z", ...fields });
  const leadMsg = (created_at, id = "m-lead") => ({ id, conversation_id: "conv-1", role: "user", source: "lead", content: "hi", created_at });
  const aiMsg = (created_at, id = "m-ai") => ({ id, conversation_id: "conv-1", role: "assistant", source: "agent", content: "what are you looking for?", created_at });
  const sent = () => sendPrivateReplyToComment.mock.calls.map((c) => c[2]);

  it("a quiet lead (last message 2 days ago) gets a contextual AI reply to the comment, not the template", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(48))] });
    generateCommentReply.mockResolvedValueOnce({ kind: "reply", text: "Good timing! The Botox special is still on, want the link to grab a spot?" });
    await handleCommentEvent(...comment("c-1", "is this still going?"));
    expect(generateCommentReply).toHaveBeenCalledWith(db, {
      userId: "u1",
      conversation: expect.objectContaining({ id: "conv-1" }),
      caption: CAPTION,
      commentText: "is this still going?",
    });
    // Already disclosed: no AI intro.
    expect(sent()).toEqual(["Good timing! The Botox special is still on, want the link to grab a spot?"]);
    expect(db.tables.messages.filter((m) => m.conversation_id === "conv-1").at(-1)).toMatchObject({
      role: "assistant",
      source: "agent",
      content: "Good timing! The Botox special is still on, want the link to grab a spot?",
    });
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm", dispatched: true });
  });

  it("a quiet thread never disclosed yet: the reply carries the AI intro", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread({ disclosed_at: null })], messages: [leadMsg(ago(48))] });
    generateCommentReply.mockResolvedValueOnce({ kind: "reply", text: "Hey! Good timing, the special is still on." });
    await handleCommentEvent(...comment());
    expect(sent()).toEqual([`${LINE} Good timing, the special is still on.`]);
  });

  it("lead active 1 hour ago: skipped, logged with the reason", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(1))] });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(generateCommentReply).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm_skipped_open_thread", dispatch_error: "open_thread:active", dispatched: false });
  });

  it("our message 1 hour ago, the lead last seen 7 hours ago (before it): awaiting their reply, skipped", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(7)), aiMsg(ago(1))] });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm_skipped_open_thread", dispatch_error: "open_thread:awaiting_reply" });
  });

  it("the lead replied 7 hours ago, after our message 30 hours ago: quiet, contextual reply", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [aiMsg(ago(30)), leadMsg(ago(7))] });
    await handleCommentEvent(...comment());
    expect(sent()).toEqual(["Contextual reply."]);
  });

  it.each([
    ["paused (ai_paused)", { ai_paused: true }],
    ["taken over (status manual)", { status: "manual" }],
  ])("a %s thread: skipped, logged open_thread:paused", async (_l, fields) => {
    setup(MANAGED, { templates: tpl, conversations: [thread(fields)], messages: [leadMsg(ago(72))] });
    await handleCommentEvent(...comment());
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm_skipped_open_thread", dispatch_error: "open_thread:paused" });
  });

  it.each([
    ["paused", { ai_paused: true }, []],
    ["active", {}, [leadMsg(ago(1))]],
    ["quiet", {}, [leadMsg(ago(48))]],
  ])("a complaint on a %s thread hands off, about that thread", async (_l, fields, messages) => {
    setup({ ...MANAGED, business_name: "Solé Aesthetics" }, { templates: tpl, webhooks: [WEBHOOK], conversations: [thread(fields)], messages });
    classifyAs("HIGH_INTENT", 0.95);
    await handleCommentEvent(...comment("c-1", "my lips are still lumpy, how do I fix this?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(generateCommentReply).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review" });
    expect(db.tables.outbound_webhook_events).toEqual([
      expect.objectContaining({ event_type: "handoff_requested", conversation_id: "conv-1", data: { reason: "other" } }),
    ]);
  });

  it("a scheduled drip on the thread is cancelled when the reply goes out (one message, not two)", async () => {
    setup(MANAGED, {
      templates: tpl,
      conversations: [thread()],
      messages: [leadMsg(ago(48))],
      drips: [
        { id: "d-1", conversation_id: "conv-1", status: "scheduled" },
        { id: "d-2", conversation_id: "conv-other", status: "scheduled" },
      ],
    });
    await handleCommentEvent(...comment());
    expect(db.tables.dm_drip_queue).toEqual([
      expect.objectContaining({ id: "d-1", status: "canceled", skip_reason: "comment_reply_sent" }),
      expect.objectContaining({ id: "d-2", status: "scheduled" }),
    ]);
  });

  it("a failed send leaves the drip scheduled", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(48))], drips: [{ id: "d-1", conversation_id: "conv-1", status: "scheduled" }] });
    sendPrivateReplyToComment.mockResolvedValueOnce({ success: false, error: "meta_error", retryable: true });
    await handleCommentEvent(...comment());
    expect(db.tables.dm_drip_queue[0].status).toBe("scheduled");
  });

  it("a medical question: the holding text goes out and the thread pauses with the category (handoff_requested)", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(48))] });
    generateCommentReply.mockResolvedValueOnce({ kind: "handoff", category: "medical_question", text: "Good question, someone from the team will get back to you." });
    await handleCommentEvent(...comment("c-1", "can I get botox while pregnant?"));
    expect(sent()).toEqual(["Good question, someone from the team will get back to you."]);
    expect(db.tables.conversations[0]).toMatchObject({ ai_paused: true, ai_pause_reason: "medical_question" });
  });

  it("generation fails: the template goes out so the comment is still answered", async () => {
    setup(MANAGED, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(48))] });
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "generation_failed" });
    await handleCommentEvent(...comment());
    expect(sent()).toEqual(["Hey! Book: https://calendly.com/x"]);
  });

  it("no thread at all: the AI writes the first DM, with the intro", async () => {
    setup(MANAGED, { templates: tpl });
    await handleCommentEvent(...comment());
    expect(generateCommentReply).toHaveBeenCalledWith(db, expect.objectContaining({ conversation: null }));
    expect(sent()).toEqual([`${LINE} Contextual reply.`]);
  });

  it("a skipped DM still seeds the thread's treatment from the post tag (lead_updated)", async () => {
    setup({ ...MANAGED, treatment_categories: TREATMENTS }, {
      templates: tpl,
      webhooks: [WEBHOOK],
      monitoring: { treatment_key: "lip_filler" },
      conversations: [thread({ ai_paused: true })],
    });
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.lead_profiles).toEqual([
      expect.objectContaining({ conversation_id: "conv-1", treatment_interest: "lip_filler", instagram_username: "jane" }),
    ]);
  });

  it("coach accounts unchanged: an active thread still gets the template, no AI generation", async () => {
    setup({ ...MANAGED, billing_managed: false, business_name: null }, { templates: tpl, conversations: [thread()], messages: [leadMsg(ago(1))] });
    await handleCommentEvent(...comment());
    expect(generateCommentReply).not.toHaveBeenCalled();
    expect(sent()).toEqual(["Hey! Book: https://calendly.com/x"]);
  });
});

describe("comment-to-DM: live case 2026-10-08 (comment 18118746053059317)", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const CAPTION = "Grand Opening.. Comment Botox for 10% off";
  const COMMENT = "I would love to check you guys out... Botox";
  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Here's the 10% off: {{BOOKING_LINK}}" }];
  // A managed clinic account, as the live account was.
  const CLINIC = { billing_managed: true, instagram_username: "soleaesthetics", calendly_url: "https://calendly.com/sole/consult" };
  const newPostComment = () => {
    const [entry, change] = comment("18118746053059317", COMMENT);
    return [entry, { ...change, value: { ...change.value, media: { id: "media-grand-opening" } } }];
  };

  it("first comment on the auto-watched post: caption fetched, classified UNCERTAIN 0.55, still DMs (AI-written)", async () => {
    setup(CLINIC, { templates: tpl, monitoringRows: [] });
    getOwnMedia.mockResolvedValueOnce({ caption: CAPTION, permalink: "https://www.instagram.com/p/DPq1AbCdEfG/", media_type: "IMAGE" });
    classifyAs("UNCERTAIN", 0.55);
    await handleCommentEvent(...newPostComment());
    expect(getOwnMedia).toHaveBeenCalledWith("media-grand-opening", "page-token", { igAccountId: IGBA, username: "soleaesthetics" });
    expect(classifyComment.mock.calls[0][0].postCaption).toBe(CAPTION);
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(generateCommentReply).toHaveBeenCalledWith(db, { userId: "u1", conversation: null, caption: CAPTION, commentText: COMMENT });
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Contextual reply.`);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm", dispatched: true });
    expect(db.tables.comment_classifications[0]).toMatchObject({ class: "UNCERTAIN", confidence: 0.55 });
  });

  it("the live post as it is now (watched, still no caption): the caption is filled and the comment DMs", async () => {
    setup(CLINIC, {
      templates: tpl,
      posts: [{ id: "p-go", creator_id: "u1", ig_media_id: "media-grand-opening", caption: null, media_type: "WEBHOOK_INGEST" }],
      monitoringRows: [{ creator_id: "u1", post_id: "p-go", enabled: true, actions_per_class: null }],
    });
    getOwnMedia.mockResolvedValueOnce({ caption: CAPTION, permalink: null, media_type: "IMAGE" });
    classifyAs("UNCERTAIN", 0.55);
    await handleCommentEvent(...newPostComment());
    expect(db.tables.posts.find((p) => p.id === "p-go")).toMatchObject({ caption: CAPTION, media_type: "IMAGE" });
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
  });

  it("even if Meta still can't be read, the intent signal DMs", async () => {
    setup(CLINIC, { templates: tpl, monitoringRows: [] });
    getOwnMedia.mockResolvedValueOnce(null);
    classifyAs("UNCERTAIN", 0.55);
    await handleCommentEvent(...newPostComment());
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
  });

  it("coach accounts unchanged: the same comment UNCERTAIN is queued, no DM", async () => {
    setup({ ...CLINIC, business_name: null, billing_managed: false }, { templates: tpl, monitoringRows: [{ creator_id: "u1", post_id: "p1", enabled: true, actions_per_class: null }] });
    classifyAs("UNCERTAIN", 0.55);
    await handleCommentEvent(...comment("c-1", COMMENT));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review" });
  });
});

describe("comment-to-DM: clinic intent signal", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Book: {{BOOKING_LINK}}" }];
  const CLINIC = { billing_managed: false, calendly_url: "https://calendly.com/x", treatment_categories: TREATMENTS };

  it.each([
    ["names a treatment's match term", "lips 👀"],
    ["names a treatment's label", "lip filler??"],
    ["an interest phrase", "how much"],
  ])("UNCERTAIN that %s DMs", async (_l, text) => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", text));
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });

  it("the post's tagged treatment, named in the comment, DMs", async () => {
    setup({ ...CLINIC, treatment_categories: [{ key: "hydrafacial", match: ["hydra"], label: "HydraFacial" }] }, {
      templates: tpl,
      monitoring: { treatment_key: "hydrafacial" },
    });
    classifyAs("LOW_SIGNAL", 0.9);
    await handleCommentEvent(...comment("c-1", "hydrafacial 🙌"));
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
  });

  it("UNCERTAIN without a signal still hands off", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "what lane?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("a complaint with a signal still hands off", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "I want my money back for the botox"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("spam that names a treatment is still ignored", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    classifyAs("SPAM", 0.99);
    await handleCommentEvent(...comment("c-1", "cheap botox at my page, follow me"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });

  it("no HIGH_INTENT template: a signal comment hands off instead", async () => {
    setup(CLINIC, { templates: [], webhooks: [WEBHOOK] });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "how much"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("a post that sets HIGH_INTENT to ignore is respected", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK], monitoring: { actions_per_class: { HIGH_INTENT: "ignore" } } });
    classifyAs("UNCERTAIN", 0.5);
    await handleCommentEvent(...comment("c-1", "how much"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });
});

describe("comment-to-DM: AI-written first DM (managed accounts)", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Thanks for asking about {{TREATMENT|our services}}! {{BOOKING_LINK}}" }];
  const CLINIC = { billing_managed: true, calendly_url: "https://calendly.com/x", treatment_categories: TREATMENTS };
  const sent = () => sendPrivateReplyToComment.mock.calls.map((c) => c[2]);

  it("a treatment the comment names beats the post's tag: seeded on the lead and in the fallback template", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK], monitoring: { treatment_key: "lip_filler" } });
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "generation_failed" });
    await handleCommentEvent(...comment("c-1", "how much is botox?"));
    expect(sent()).toEqual([`${LINE} Thanks for asking about Botox! https://calendly.com/x`]);
    expect(db.tables.lead_profiles[0]).toMatchObject({ treatment_interest: "botox" });
  });

  it("a comment naming no treatment: the post's tag is used", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK], monitoring: { treatment_key: "lip_filler" } });
    await handleCommentEvent(...comment("c-1", "how much??"));
    expect(db.tables.lead_profiles[0]).toMatchObject({ treatment_interest: "lip_filler" });
  });

  it("non-managed clinic accounts keep the post's tag first (unchanged)", async () => {
    setup({ ...CLINIC, billing_managed: false }, { templates: tpl, webhooks: [WEBHOOK], monitoring: { treatment_key: "lip_filler" } });
    await handleCommentEvent(...comment("c-1", "how much is botox?"));
    expect(sent()).toEqual([`${LINE} Thanks for asking about lip filler! https://calendly.com/x`]);
    expect(db.tables.lead_profiles[0]).toMatchObject({ treatment_interest: "lip_filler" });
    expect(generateCommentReply).not.toHaveBeenCalled();
  });

  it("generation fails: the high-intent template goes out instead", async () => {
    setup(CLINIC, { templates: tpl });
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "lint_blocked" });
    await handleCommentEvent(...comment("c-1", "how much??"));
    expect(sent()).toEqual([`${LINE} Thanks for asking about our services! https://calendly.com/x`]);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm", dispatched: true });
  });

  it("no template: the AI-written DM still goes out", async () => {
    setup(CLINIC, { templates: [], webhooks: [WEBHOOK] });
    generateCommentReply.mockResolvedValueOnce({ kind: "reply", text: "Botox is $12 a unit right now, want the link to book?" });
    await handleCommentEvent(...comment("c-1", "how much is botox?"));
    expect(sent()).toEqual([`${LINE} Botox is $12 a unit right now, want the link to book?`]);
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "dm", dispatched: true });
  });

  it("no template and generation fails: handed off as before, and no outbound slot spent", async () => {
    setup(CLINIC, { templates: [], webhooks: [WEBHOOK] });
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    db.rpc = rpc;
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "generation_failed" });
    await handleCommentEvent(...comment("c-1", "how much is botox?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review", dispatched: false });
    expect(db.tables.outbound_webhook_events).toEqual([expect.objectContaining({ event_type: "handoff_requested", data: expect.objectContaining({ reason: "other" }) })]);
  });

  it("a medical question on a first DM: holding text with the intro, the new thread paused with the category", async () => {
    setup(CLINIC, { templates: tpl });
    generateCommentReply.mockResolvedValueOnce({ kind: "handoff", category: "medical_question", text: "Good question, someone from the team will get back to you shortly." });
    await handleCommentEvent(...comment("c-1", "can I get botox while breastfeeding?"));
    expect(sent()).toEqual([`${LINE} Good question, someone from the team will get back to you shortly.`]);
    expect(db.tables.conversations[0]).toMatchObject({ instagram_sender_id: LEAD, ai_paused: true, ai_pause_reason: "medical_question" });
  });

  it("a complaint still hands off; the AI is never asked", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    await handleCommentEvent(...comment("c-1", "my botox went wrong and I want a refund"));
    expect(generateCommentReply).not.toHaveBeenCalled();
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.outbound_webhook_events).toHaveLength(1);
  });

  it("coach accounts unchanged: no template still queues, no AI", async () => {
    setup({ business_name: null, billing_managed: false }, { templates: [] });
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(generateCommentReply).not.toHaveBeenCalled();
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "queue_review" });
  });
});

describe("comment-to-DM: two comments minutes apart (live 2026-10-08, comments 18059428940796919 / 17964457908197950)", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const CLINIC = { billing_managed: true, calendly_url: "https://calendly.com/x", treatment_categories: TREATMENTS };
  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Book: {{BOOKING_LINK}}" }];
  const onPost = (id, media, text) => {
    const [entry, change] = comment(id, text);
    return [entry, { ...change, value: { ...change.value, media: { id: media } } }];
  };
  const posts = [{ id: "p2", creator_id: "u1", caption: "Lip filler week", ig_media_id: "media-2" }];
  const monitoringRows = [
    { creator_id: "u1", post_id: "p1", enabled: true, actions_per_class: null },
    { creator_id: "u1", post_id: "p2", enabled: true, actions_per_class: null },
  ];

  it("the second comment, before any reply, gets no second DM (awaiting_reply); both are recorded", async () => {
    setup(CLINIC, { templates: tpl, posts, monitoringRows });
    await handleCommentEvent(...onPost("18059428940796919", "media-1", "how much?"));
    await handleCommentEvent(...onPost("17964457908197950", "media-2", "and this one?"));
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(generateCommentReply).toHaveBeenCalledTimes(1);
    expect(db.tables.comment_classifications.map((c) => c.ig_comment_id)).toEqual(["18059428940796919", "17964457908197950"]);
    expect(db.tables.comment_to_dm_log.map((l) => [l.decided_action, l.dispatch_error ?? null])).toEqual([
      ["dm", null],
      ["dm_skipped_open_thread", "open_thread:awaiting_reply"],
    ]);
  });

  it("the second comment names another treatment: the lead's treatment is updated and lead_updated emitted", async () => {
    setup(CLINIC, { templates: tpl, posts, monitoringRows, webhooks: [WEBHOOK] });
    await handleCommentEvent(...onPost("c-a", "media-1", "how much is botox?"));
    expect(db.tables.lead_profiles[0].treatment_interest).toBe("botox");
    await handleCommentEvent(...onPost("c-b", "media-2", "actually how much for lip filler?"));
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    const conv = db.tables.conversations[0].id;
    expect(db.tables.lead_profiles).toEqual([expect.objectContaining({ conversation_id: conv, treatment_interest: "lip_filler" })]);
    expect(db.tables.outbound_webhook_events).toEqual([
      expect.objectContaining({ event_type: "lead_updated", conversation_id: conv, dedupe_key: `lead_updated:${conv}:treatment:lip_filler` }),
    ]);
  });

  it("a second comment naming no treatment keeps the first one", async () => {
    setup(CLINIC, { templates: tpl, posts, monitoringRows, webhooks: [WEBHOOK] });
    await handleCommentEvent(...onPost("c-a", "media-1", "how much is botox?"));
    await handleCommentEvent(...onPost("c-b", "media-2", "so cute"));
    expect(db.tables.lead_profiles[0].treatment_interest).toBe("botox");
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
  });

  it("once they reply to the DM, a later comment is judged by their reply (active within 6h)", async () => {
    setup(CLINIC, { templates: tpl, posts, monitoringRows });
    await handleCommentEvent(...onPost("c-a", "media-1", "how much?"));
    // Their DM reply, as the inbound webhook stores it on the same thread.
    db.tables.messages.push({ id: "m-in", conversation_id: db.tables.conversations[0].id, role: "user", source: "lead", content: "yes please", created_at: new Date().toISOString() });
    await handleCommentEvent(...onPost("c-b", "media-2", "how much?"));
    expect(sendPrivateReplyToComment).toHaveBeenCalledTimes(1);
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ dispatch_error: "open_thread:active" });
  });
});

describe("comment-to-DM: AI unavailable (Anthropic call fails)", () => {
  beforeEach(() => decideAction.mockImplementation(actual.decideAction));

  const CLINIC = { billing_managed: true, calendly_url: "https://calendly.com/x" };
  const tpl = [{ creator_id: "u1", intent_class: "HIGH_INTENT", template: "Hey! Book: {{BOOKING_LINK}}" }];
  const credit = () => Object.assign(new Error("Your credit balance is too low to access the Anthropic API."), { status: 400 });
  const alerts = () => sendEmail.mock.calls.filter(([m]) => /AI unavailable/.test(m.subject));

  it("classification fails: saved as class 'error', shown in Comment Activity, handed off, operator alerted, nothing sent", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    classifyComment.mockRejectedValueOnce(credit());
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    const row = db.tables.comment_classifications[0];
    expect(row).toMatchObject({ ig_comment_id: "c-1", comment_text: "how much?", class: "error", confidence: 0, signals: ["ai_unavailable"] });
    expect(row.reasoning).toBe("AI unavailable, needs a reply: 400 Your credit balance is too low to access the Anthropic API.");
    expect(db.tables.comment_to_dm_log).toEqual([
      expect.objectContaining({
        comment_classification_id: row.id,
        decided_action: "ai_unavailable",
        dispatched: false,
        dispatch_error: "AI unavailable, needs a reply (400 Your credit balance is too low to access the Anthropic API.)",
      }),
    ]);
    expect(db.tables.outbound_webhook_events).toEqual([
      expect.objectContaining({
        event_type: "handoff_requested",
        conversation_id: null,
        data: { reason: "other", comment_lead: { id: row.id, instagram_username: "jane" } },
      }),
    ]);
    expect(alerts()).toHaveLength(1);
    expect(alerts()[0][0].html).toContain("failed at: comment_classification");
  });

  it("the operator is alerted at most once an hour per account", async () => {
    setup(CLINIC, { templates: tpl });
    classifyComment.mockRejectedValueOnce(credit()).mockRejectedValueOnce(credit());
    await handleCommentEvent(...comment("c-1", "how much?"));
    await handleCommentEvent(...comment("c-2", "price?"));
    expect(db.tables.comment_classifications.map((c) => c.class)).toEqual(["error", "error"]);
    expect(alerts()).toHaveLength(1);
    expect(db.tables.email_events).toEqual([expect.objectContaining({ user_id: "u1", event_type: "ai_unavailable_alert" })]);
  });

  it("an alert sent over an hour ago doesn't hold back a new one", async () => {
    setup(CLINIC, { templates: tpl, emailEvents: [{ id: "e0", user_id: "u1", event_type: "ai_unavailable_alert", sent_at: new Date(Date.now() - 61 * 60_000).toISOString() }] });
    classifyComment.mockRejectedValueOnce(credit());
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(alerts()).toHaveLength(1);
  });

  it("the reply fails: no template goes out, the comment is handed off with the reason", async () => {
    setup(CLINIC, { templates: tpl, webhooks: [WEBHOOK] });
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "ai_unavailable", error: credit() });
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(sendPrivateReplyToComment).not.toHaveBeenCalled();
    expect(db.tables.comment_classifications[0].class).toBe("HIGH_INTENT");
    expect(db.tables.comment_to_dm_log.at(-1)).toMatchObject({ decided_action: "ai_unavailable", dispatched: false });
    expect(db.tables.outbound_webhook_events).toEqual([expect.objectContaining({ event_type: "handoff_requested", data: expect.objectContaining({ reason: "other" }) })]);
    expect(alerts()[0][0].html).toContain("failed at: comment_reply");
  });

  it("a reply blocked for content (not an outage) still falls back to the template", async () => {
    setup(CLINIC, { templates: tpl });
    generateCommentReply.mockResolvedValueOnce({ kind: "failed", reason: "lint_blocked" });
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(sendPrivateReplyToComment.mock.calls[0][2]).toBe(`${LINE} Book: https://calendly.com/x`);
    expect(alerts()).toHaveLength(0);
  });

  it("coach accounts unchanged: a classifier failure saves nothing and alerts no one", async () => {
    setup({ business_name: null, billing_managed: false }, { templates: tpl, webhooks: [WEBHOOK] });
    classifyComment.mockRejectedValueOnce(credit());
    await handleCommentEvent(...comment("c-1", "how much?"));
    expect(db.tables.comment_classifications).toHaveLength(0);
    expect(db.tables.comment_to_dm_log).toHaveLength(0);
    expect(db.tables.outbound_webhook_events).toHaveLength(0);
    expect(alerts()).toHaveLength(0);
  });
});
