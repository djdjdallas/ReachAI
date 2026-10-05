import { describe, it, expect, vi, beforeEach } from "vitest";

// Route-level test of the inbound DM path. Every module that can reach a
// model, Meta, email, or the drip queue is mocked, so "zero AI or outbound
// calls" is asserted on the real call sites, not on a re-implementation.

const db = makeDb();

const ai = {
  generateReply: vi.fn(async () => "hey"),
  classifyIncomingMessage: vi.fn(async () => ({ needs_human: false })),
};
const ig = {
  sendInstagramMessage: vi.fn(async () => ({ message_id: "out-1" })),
  sendSenderAction: vi.fn(async () => ({})),
  verifyWebhookSignature: vi.fn(() => true),
  getParticipantProfile: vi.fn(async () => ({ name: "Lead", username: "lead" })),
};
const dmIntent = {
  classifyDMIntent: vi.fn(async () => ({ intent: "question", confidence: 0.9 })),
  DM_INTENT_VERSION: "test",
  VOICE_ROUTING_THRESHOLD: 0.8,
  withTimeout: (p) => p,
};
const voice = {
  sendVoiceMessage: vi.fn(async () => ({})),
  logVoiceSend: vi.fn(async () => ({})),
};
const notifications = {
  sendHotLeadAlert: vi.fn(async () => ({})),
  sendBookingAlert: vi.fn(async () => ({})),
};
const handoff = { sendHandoffEmail: vi.fn(async () => ({})) };
const drip = { cancelDripForConversation: vi.fn(async () => 0) };

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal()),
  after: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/anthropic", () => ai);
vi.mock("@/lib/prompts", () => ({ buildSystemPrompt: vi.fn(() => "prompt") }));
vi.mock("@/lib/instagram", () => ig);
vi.mock("@/lib/token-utils", () => ({ decryptToken: vi.fn(() => "page-token") }));
vi.mock("@/lib/tokens/reconnect", () => ({
  isMetaTokenRevoked: vi.fn(() => false),
  flagMetaReconnect: vi.fn(async () => {}),
}));
vi.mock("@/lib/notifications", () => notifications);
vi.mock("@/lib/alerts/handoff-email", () => handoff);
vi.mock("@/lib/posthog-server", () => ({
  getPostHogClient: () => ({ capture: vi.fn() }),
}));
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@/lib/webhooks/comment-event", () => ({ handleCommentEvent: vi.fn() }));
vi.mock("@/lib/dm-intent", () => dmIntent);
vi.mock("@/lib/intent-status", () => ({ statusForIntent: vi.fn(() => null) }));
vi.mock("@/lib/dm-intent-gate", () => ({
  decideIntentGate: vi.fn(() => ({ action: "reply" })),
}));
vi.mock("@/lib/active-offer", () => ({
  getActiveOffer: vi.fn(async () => null),
  ownerFromUser: vi.fn(() => ({})),
}));
vi.mock("@/lib/reply-lint", () => ({ lintReply: vi.fn((t) => ({ text: t })) }));
vi.mock("@/lib/voice/matcher", () => ({
  findVoiceSnippetForIntent: vi.fn(async () => ({ snippet: null, reason: "no_snippet" })),
  getSendableAudioUrl: vi.fn(async () => null),
}));
vi.mock("@/lib/voice/sender", () => voice);
vi.mock("@/lib/drip/queue", () => drip);

const { POST } = await import("./route");
const { lateDelivery, LATE_HOURS } = await import("@/lib/instagram/late-delivery.fixture");

const IGBA = "17841400000000000";
const LEAD = "lead-igsid-1";

function inbound(text = "how much is coaching?", mid = "mid-1", timestamp = undefined) {
  const body = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: IGBA,
        messaging: [
          { sender: { id: LEAD }, recipient: { id: IGBA }, timestamp, message: { mid, text } },
        ],
      },
    ],
  });
  return new Request("https://app.test/api/webhooks/instagram", {
    method: "POST",
    headers: { "x-hub-signature-256": "sha256=test" },
    body,
  });
}

function user(overrides = {}) {
  return {
    id: "user-1",
    email: "coach@example.com",
    instagram_business_account_id: IGBA,
    meta_page_access_token: "enc",
    meta_reconnect_required: false,
    // A paying Stripe-backed account (access via src/lib/billing/access.js).
    subscription_status: "active",
    stripe_subscription_id: "sub_test",
    current_period_end: new Date(Date.now() + 20 * 24 * 3_600_000).toISOString(),
    trial_ends_at: null,
    ai_mode: "active",
    response_delay: 0,
    plan: "unlimited",
    dm_count_this_month: 0,
    dm_count_reset_at: new Date().toISOString(),
    script_config: { greeting: "Hey, thanks for reaching out!", offer: "1:1 coaching" },
    ...overrides,
  };
}

const AI_AND_OUTBOUND = () => ({
  generateReply: ai.generateReply.mock.calls.length,
  classifyIncomingMessage: ai.classifyIncomingMessage.mock.calls.length,
  classifyDMIntent: dmIntent.classifyDMIntent.mock.calls.length,
  sendInstagramMessage: ig.sendInstagramMessage.mock.calls.length,
  sendSenderAction: ig.sendSenderAction.mock.calls.length,
  sendVoiceMessage: voice.sendVoiceMessage.mock.calls.length,
  sendHotLeadAlert: notifications.sendHotLeadAlert.mock.calls.length,
  sendBookingAlert: notifications.sendBookingAlert.mock.calls.length,
  sendHandoffEmail: handoff.sendHandoffEmail.mock.calls.length,
  cancelDripForConversation: drip.cancelDripForConversation.mock.calls.length,
  increment_dm_count: db.rpcCalls.filter((c) => c.name === "increment_dm_count").length,
});
const NONE = Object.fromEntries(Object.keys(AI_AND_OUTBOUND()).map((k) => [k, 0]));

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  process.env.INSTAGRAM_APP_SECRET = "test-secret";
});

describe("inbound DM for a non-serving account (C1)", () => {
  it("saves the lead's message for an expired user and makes zero AI or outbound calls", async () => {
    db.state.user = user({ subscription_status: "expired", ai_mode: "off" });

    const res = await POST(inbound());
    expect(res.status).toBe(200);

    const saved = db.inserted("messages");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      role: "user",
      source: "lead",
      content: "how much is coaching?",
      provider_message_id: "mid-1",
    });
    expect(db.conversationSkipReasons()).toContain("subscription_inactive");
    expect(db.classificationReasons()).toContain(
      "gated before classification: subscription_inactive"
    );
    expect(AI_AND_OUTBOUND()).toEqual(NONE);
  });

  it("does the same for a canceled user with an existing thread", async () => {
    db.state.user = user({ subscription_status: "canceled", ai_mode: "off" });
    db.state.conversation = { id: "conv-existing", user_id: "user-1", instagram_sender_id: LEAD };

    await POST(inbound());

    expect(db.inserted("messages")[0]).toMatchObject({ conversation_id: "conv-existing", source: "lead" });
    expect(db.inserted("conversations")).toHaveLength(0);
    expect(db.conversationSkipReasons()).toContain("subscription_inactive");
    expect(AI_AND_OUTBOUND()).toEqual(NONE);
  });

  it("a lapsed legacy no-card trial: saves the message, no AI or outbound call, and no status flip", async () => {
    db.state.user = user({
      subscription_status: "trialing",
      stripe_subscription_id: null,
      current_period_end: null,
      trial_ends_at: new Date(Date.now() - 60_000).toISOString(),
    });

    await POST(inbound());

    // Access is computed (hasActiveAccess), never stored: the old lazy flip
    // to 'expired' + ai_mode 'off' is gone.
    expect(db.userUpdates().some((u) => "subscription_status" in u || "ai_mode" in u)).toBe(false);
    expect(db.inserted("messages")).toHaveLength(1);
    expect(db.conversationSkipReasons()).toContain("trial_expired");
    expect(AI_AND_OUTBOUND()).toEqual(NONE);
  });

  it("a Meta redelivery of the same message does not save it twice", async () => {
    db.state.user = user({ subscription_status: "expired", ai_mode: "off" });
    await POST(inbound("hi", "mid-dup"));
    await POST(inbound("hi", "mid-dup"));
    expect(db.inserted("messages")).toHaveLength(1);
  });
});

describe("inbound DM for a serving account (unchanged)", () => {
  it("an active user goes through the reply pipeline, not the inactive gate", async () => {
    // base plan, so the DM metering step runs too.
    db.state.user = user({ plan: "base" });

    await POST(inbound());

    expect(db.inserted("messages")[0]).toMatchObject({ role: "user", source: "lead" });
    expect(db.conversationSkipReasons()).not.toContain("subscription_inactive");
    expect(db.classificationReasons()).not.toContain(
      "gated before classification: subscription_inactive"
    );
    // Metered and classified like before: the pipeline ran past the gates.
    expect(db.rpcCalls.map((c) => c.name)).toContain("increment_dm_count");
    expect(dmIntent.classifyDMIntent).toHaveBeenCalled();
    expect(ai.generateReply).toHaveBeenCalled();
    expect(ig.sendInstagramMessage).toHaveBeenCalled();
    // The reply carries the lead's arrival time into the send's 24h guard.
    expect(ig.sendInstagramMessage.mock.calls[0][4]).toEqual({ lastInboundAt: expect.any(Number) });
  });

  it("an active user in handoff mode keeps the handoff behavior (saved, ai_inactive, no AI)", async () => {
    db.state.user = user({ ai_mode: "handoff" });

    await POST(inbound());

    expect(db.inserted("messages")).toHaveLength(1);
    expect(db.conversationSkipReasons()).toEqual(["ai_inactive"]);
    expect(AI_AND_OUTBOUND()).toEqual(NONE);
  });

  it("an active user with ai_mode off still saves nothing (existing contract)", async () => {
    db.state.user = user({ ai_mode: "off" });

    await POST(inbound());

    expect(db.inserted("messages")).toHaveLength(0);
    expect(db.conversationSkipReasons()).toEqual(["ai_inactive"]);
  });

  it("a past_due user is still served (grace window)", async () => {
    db.state.user = user({ subscription_status: "past_due" });

    await POST(inbound());

    expect(db.conversationSkipReasons()).not.toContain("subscription_inactive");
    expect(dmIntent.classifyDMIntent).toHaveBeenCalled();
  });
});

describe("send-time checks (audit L6, LM1)", () => {
  it("L6: access that ends during the reply delay stops the send", async () => {
    db.state.user = user();
    // Reply generation runs before the delay wait; the subscription ends
    // in between (the post-delay recheck reads the row again).
    ai.generateReply.mockImplementationOnce(async () => {
      db.state.user = user({ subscription_status: "canceled" });
      return "hey";
    });

    await POST(inbound());

    expect(ai.generateReply).toHaveBeenCalled();
    expect(ig.sendInstagramMessage).not.toHaveBeenCalled();
    expect(db.conversationSkipReasons()).toContain("access_ended_during_delay");
  });

  it("LM1: the 24h window is measured from Meta's event timestamp when it is earlier", async () => {
    db.state.user = user();
    const sentAt = Date.now() - 3 * 3_600_000; // delivered 3h late
    await POST(inbound("how much?", "mid-late", sentAt));
    expect(ig.sendInstagramMessage.mock.calls[0][4]).toEqual({ lastInboundAt: sentAt });
  });

  it("LM1: a future event timestamp falls back to receipt time", async () => {
    db.state.user = user();
    const before = Date.now();
    await POST(inbound("how much?", "mid-future", Date.now() + 3_600_000));
    const { lastInboundAt } = ig.sendInstagramMessage.mock.calls[0][4];
    expect(lastInboundAt).toBeGreaterThanOrEqual(before);
    expect(lastInboundAt).toBeLessThanOrEqual(Date.now());
  });
});

describe("late Meta delivery (stored with the lead's real send time)", () => {
  it(`a message sent ${LATE_HOURS}h ago and delivered now is saved with its send time, and gets no AI turn`, async () => {
    db.state.user = user();
    const late = lateDelivery();
    await POST(inbound("still interested?", "mid-30h", late.sentAtMs));

    const saved = db.inserted("messages").find((m) => m.source === "lead");
    expect(saved).toMatchObject({ role: "user", source: "lead" });
    // Within a second of the fixture (the fixture's "now" is a hair earlier).
    expect(Math.abs(Date.parse(saved.created_at) - Date.parse(late.storedCreatedAt))).toBeLessThan(1000);
    expect(db.conversationSkipReasons()).toContain("messaging_window_closed");
    expect(AI_AND_OUTBOUND()).toEqual(NONE);
  });

  it("an on-time message is saved with its send time too (no change in behavior)", async () => {
    db.state.user = user();
    const sentAt = Date.now() - 2000;
    await POST(inbound("hi", "mid-ontime", sentAt));
    const saved = db.inserted("messages").find((m) => m.source === "lead");
    expect(saved.created_at).toBe(new Date(sentAt).toISOString());
    expect(ig.sendInstagramMessage).toHaveBeenCalled();
  });

  it("inactive-account saves use the send time as well", async () => {
    db.state.user = user({ subscription_status: "canceled", ai_mode: "off" });
    const late = lateDelivery();
    await POST(inbound("hello?", "mid-inactive", late.sentAtMs));
    const saved = db.inserted("messages")[0];
    expect(Math.abs(Date.parse(saved.created_at) - late.sentAtMs)).toBeLessThan(1000);
  });
});

// ── Permissive supabase-js stand-in ──────────────────────────────────────
// Any chain resolves; the tables the inbound path reads get canned rows, and
// every write is recorded for assertions.
function makeDb() {
  const self = {
    state: {},
    ops: [],
    rpcCalls: [],
    reset() {
      self.state = { user: null, conversation: null, messages: [] };
      self.ops = [];
      self.rpcCalls = [];
    },
    inserted(table) {
      return self.ops.filter((o) => o.table === table && o.op === "insert").map((o) => o.payload);
    },
    conversationSkipReasons() {
      return self.ops
        .filter((o) => o.table === "conversations" && o.op === "update" && o.payload?.last_skip_reason)
        .map((o) => o.payload.last_skip_reason);
    },
    classificationReasons() {
      return self.ops
        .filter((o) => o.table === "messages" && o.op === "update" && o.payload?.intent_classification)
        .map((o) => o.payload.intent_classification.reason);
    },
    userUpdates() {
      return self.ops.filter((o) => o.table === "users" && o.op === "update").map((o) => o.payload);
    },
    rpc: async (name, args) => {
      self.rpcCalls.push({ name, args });
      if (name === "increment_dm_count") return { data: 1, error: null };
      return { data: null, error: null };
    },
    from(table) {
      const q = { table, op: "select", payload: null, filters: [], single: false };
      const b = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolve, reject) => {
                try {
                  resolve(run(q));
                } catch (err) {
                  reject(err);
                }
              };
            }
            if (["insert", "update", "upsert", "delete"].includes(prop)) {
              return (payload) => {
                q.op = prop;
                q.payload = payload;
                return b;
              };
            }
            if (prop === "single" || prop === "maybeSingle") {
              return () => {
                q.single = true;
                return b;
              };
            }
            if (prop === "eq" || prop === "is" || prop === "neq") {
              return (col, val) => {
                q.filters.push([prop, col, val]);
                return b;
              };
            }
            return () => b; // select, order, limit, in, gte, not, ...
          },
        }
      );
      return b;
    },
  };

  function filterVal(q, col) {
    return q.filters.find(([, c]) => c === col)?.[2];
  }

  function run(q) {
    if (q.op !== "select") self.ops.push(q);
    const { table, op } = q;

    if (table === "users" && op === "select") {
      return { data: q.single ? self.state.user : [self.state.user].filter(Boolean), error: null };
    }
    if (table === "conversations" && op === "select") {
      const conv = self.state.conversation;
      return { data: q.single ? conv : [conv].filter(Boolean), error: null };
    }
    if (table === "conversations" && op === "insert") {
      self.state.conversation = { id: "conv-new", status: "new", ai_paused: false, ...q.payload };
      return { data: self.state.conversation, error: null };
    }
    if (table === "messages" && op === "select") {
      const mid = filterVal(q, "provider_message_id");
      if (mid !== undefined) {
        const hit = self.state.messages.find((m) => m.provider_message_id === mid) || null;
        return { data: hit, error: null };
      }
      return { data: q.single ? null : self.state.messages.slice(), error: null };
    }
    if (table === "messages" && op === "insert") {
      const row = { id: `msg-${self.state.messages.length + 1}`, created_at: new Date().toISOString(), ...q.payload };
      self.state.messages.push(row);
      return { data: row, error: null };
    }
    if (op === "update") {
      return { data: q.single ? null : [], error: null };
    }
    return { data: q.single ? null : [], error: null };
  }

  self.reset();
  return self;
}
