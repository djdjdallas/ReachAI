import { describe, it, expect, vi, beforeEach } from "vitest";

// Dashboard reply: the one path that can reach an old thread. A closed
// 24h window must be refused up front (409 with the agreed copy), with no
// DM quota, no model call, no saved row and no send.

const state = { lastLeadAt: null };
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
                      instagram_business_account_id: "igba",
                      meta_page_access_token: "enc",
                      script_config: { greeting: "Hi" },
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
vi.mock("@/lib/prompts", () => ({ buildSystemPrompt: () => "prompt" }));
vi.mock("@/lib/active-offer", () => ({ getActiveOffer: async () => null, ownerFromUser: () => ({}) }));
vi.mock("@/lib/reply-lint", () => ({ lintReply: (t) => ({ text: t }) }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage }));
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/posthog-server", () => ({ getPostHogClient: () => ({ capture: vi.fn() }) }));
vi.mock("@/lib/rate-limit", () => ({ enforceAiRateLimit: async () => null }));

const { POST } = await import("./route");

const req = (body) =>
  new Request("https://app.test/api/ai/reply", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  ops.length = 0;
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

  it("sends inside the window and passes the lead's time to the send guard", async () => {
    const at = new Date(Date.now() - 3_600_000).toISOString();
    state.lastLeadAt = at;
    const res = await POST(req({ conversationId: "conv-1", message: "hey", manual: true }));
    expect(res.status).toBe(200);
    expect(sendInstagramMessage).toHaveBeenCalledTimes(1);
    expect(sendInstagramMessage.mock.calls[0][4]).toEqual({ lastInboundAt: at });
  });
});
