import { describe, it, expect, vi, beforeEach } from "vitest";

// Dashboard reply: the one path that can reach an old thread. A closed
// 24h window must be refused up front (409 with the agreed copy), with no
// DM quota, no model call, no saved row and no send.

const state = { lastLeadAt: null, userLinks: {} };
const ops = [];

function admin() {
  return {
    rpc: vi.fn(async () => ({ data: 1, error: null })),
    from(table) {
      const q = { table, op: "select", filters: [] };
      const b = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolve) => {
                ops.push(q);
                if (table === "users" && q.op === "select") {
                  return resolve({
                    data: {
                      id: "user-1",
                      plan: "unlimited",
                      subscription_status: "active",
                      stripe_subscription_id: "sub_test",
                      current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString(),
                      trial_ends_at: null,
                      instagram_business_account_id: "igba",
                      meta_page_access_token: "enc",
                      script_config: { greeting: "Hi" },
                      ...state.userLinks,
                    },
                    error: null,
                  });
                }
                if (table === "conversations" && q.op === "select") {
                  return resolve({ data: { id: "conv-1", user_id: "user-1", instagram_sender_id: "lead" }, error: null });
                }
                if (table === "messages" && q.op === "select") {
                  const isLastLead = q.filters.some(([c, v]) => c === "source" && v === "lead");
                  if (isLastLead) {
                    return resolve({ data: state.lastLeadAt ? { created_at: state.lastLeadAt } : null, error: null });
                  }
                  return resolve({ data: [], error: null });
                }
                if (table === "messages" && q.op === "insert") {
                  return resolve({ data: { id: "msg-1" }, error: null });
                }
                return resolve({ data: null, error: null });
              };
            }
            if (prop === "insert" || prop === "update") return () => ((q.op = prop), b);
            if (prop === "eq") return (c, v) => (q.filters.push([c, v]), b);
            return () => b;
          },
        }
      );
      return b;
    },
  };
}

const generateReply = vi.fn(async () => "AI text");
const sendInstagramMessage = vi.fn(async () => ({ message_id: "mid.1" }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin() }));
vi.mock("@/lib/anthropic", () => ({ generateReply }));
const buildSystemPrompt = vi.fn(() => "prompt");
vi.mock("@/lib/prompts", () => ({ buildSystemPrompt }));
vi.mock("@/lib/active-offer", () => ({ getActiveOffer: async () => null, ownerFromUser: () => ({}) }));
const lintReply = vi.fn((t) => ({ text: t, handoff: null }));
vi.mock("@/lib/reply-lint", () => ({ lintReply }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/posthog-server", () => ({ getPostHogClient: () => ({ capture: vi.fn() }) }));
vi.mock("@/lib/rate-limit", () => ({ enforceAiRateLimit: async () => null }));

const { POST } = await import("./route");
const { lateDelivery, LATE_HOURS } = await import("@/lib/instagram/late-delivery.fixture");

const req = (body) =>
  new Request("https://app.test/api/ai/reply", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  ops.length = 0;
  state.userLinks = {};
  buildSystemPrompt.mockClear();
  lintReply.mockClear();
  generateReply.mockClear();
  sendInstagramMessage.mockClear();
});

describe("POST /api/ai/reply messaging window", () => {
  it.each([
    ["lead's last message 25h ago", () => new Date(Date.now() - 25 * 3_600_000).toISOString()],
    ["lead never messaged (outbound-first)", () => null],
  ])("refuses when %s: 409, nothing generated, saved or sent", async (_label, at) => {
    state.lastLeadAt = at();
    const res = await POST(req({ conversationId: "conv-1", message: "hey", manual: true }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "messaging_window_closed",
      message: "Reply window closed. Reply from the Instagram app.",
    });
    expect(generateReply).not.toHaveBeenCalled();
    expect(sendInstagramMessage).not.toHaveBeenCalled();
    expect(ops.some((o) => o.table === "messages" && o.op === "insert")).toBe(false);
  });

  it(`a lead message Meta delivered ${LATE_HOURS}h late (stored with its send time) reads as a closed window`, async () => {
    // The webhook stores the lead's real send time (see the Instagram route
    // test); this is that row as the dashboard reply reads it.
    state.lastLeadAt = lateDelivery().storedCreatedAt;
    const res = await POST(req({ conversationId: "conv-1", message: "hey", manual: true }));
    expect(res.status).toBe(409);
    expect(sendInstagramMessage).not.toHaveBeenCalled();
    expect(ops.some((o) => o.table === "messages" && o.op === "insert")).toBe(false);
  });

  it("sends inside the window and passes the lead's time to the send guard", async () => {
    const at = new Date(Date.now() - 3_600_000).toISOString();
    state.lastLeadAt = at;
    const res = await POST(req({ conversationId: "conv-1", message: "hey", manual: true }));
    expect(res.status).toBe(200);
    expect(sendInstagramMessage).toHaveBeenCalledTimes(1);
    expect(sendInstagramMessage.mock.calls[0][4]).toEqual({ lastInboundAt: at });
  });
});

describe("POST /api/ai/reply knowledge handoff", () => {
  it.each([
    ["medical_question", /medical or health/],
    ["missing_knowledge", /business knowledge doesn't cover/],
  ])("an AI reply that hands off (%s) is refused: 409, nothing saved or sent", async (category, msg) => {
    state.lastLeadAt = new Date(Date.now() - 3_600_000).toISOString();
    lintReply.mockReturnValueOnce({ text: "", blocked: true, handoff: { category, malformed: false } });
    const res = await POST(req({ conversationId: "conv-1", message: "is botox ok while pregnant?", manual: false }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ error: "knowledge_handoff", category });
    expect(body.message).toMatch(msg);
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(sendInstagramMessage).not.toHaveBeenCalled();
    expect(ops.some((o) => o.table === "messages" && o.op === "insert")).toBe(false);
  });
});

describe("POST /api/ai/reply booking link", () => {
  it.each([
    ["booking_url first", { booking_url: "https://book.sole.example/now", calendly_url: "https://calendly.com/sole/consult" }, "https://book.sole.example/now"],
    ["Calendly as the fallback", { booking_url: null, calendly_url: "https://calendly.com/sole/consult" }, "https://calendly.com/sole/consult"],
  ])("an AI reply uses %s", async (_label, links, expected) => {
    state.lastLeadAt = new Date(Date.now() - 3_600_000).toISOString();
    state.userLinks = links;
    const res = await POST(req({ conversationId: "conv-1", message: "how do I book?", manual: false }));
    expect(res.status).toBe(200);
    expect(buildSystemPrompt.mock.calls[0][1]).toBe(expected);
    expect(lintReply.mock.calls[0][1]).toEqual({ bookingLink: expected });
  });
});
