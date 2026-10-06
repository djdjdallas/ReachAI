import { describe, it, expect, vi, beforeEach } from "vitest";

// Drip processor, window condition (CONDITION 5) against a lead message
// Meta delivered late. The webhook stores the lead's real send time, so a
// message sent 30h ago is 30h old here too and the nudge must not go out.

const state = { messages: [], persona: false, conv: { id: "conv-1", disclosed_at: null } };
const decryptToken = vi.fn(() => "token");
const markDripStatus = vi.fn(async (id, status, extra) => ({ status, ...extra }));
const sendInstagramMessage = vi.fn(async () => ({ message_id: "mid.drip" }));

function admin() {
  return {
    rpc: vi.fn(async () => ({ data: true, error: null })),
    from(table) {
      const q = { table, op: "select" };
      const b = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolve) => {
                if (table === "users") {
                  return resolve({
                    data: {
                      id: "user-1",
                      drip_enabled: true,
                      ai_mode: "active",
                      plan: "unlimited",
                      subscription_status: "active",
                      stripe_subscription_id: "sub_test",
                      current_period_end: new Date(Date.now() + 20 * 86_400_000).toISOString(),
                      trial_ends_at: null,
                      meta_page_access_token: "enc",
                      instagram_business_account_id: "igba",
                      ...(state.persona ? { business_name: "Solé Aesthetics", assistant_name: "Katlynne" } : {}),
                    },
                    error: null,
                  });
                }
                if (table === "conversations" && q.op === "update" && q.payload && "disclosed_at" in q.payload) {
                  // Disclosure claim (sets a value only while null) and release.
                  if (q.payload.disclosed_at !== null && state.conv.disclosed_at !== null) return resolve({ data: [], error: null });
                  state.conv.disclosed_at = q.payload.disclosed_at;
                  return resolve({ data: [{ id: "conv-1", disclosed_at: state.conv.disclosed_at }], error: null });
                }
                if (table === "conversations" && q.op === "select") {
                  return resolve({ data: { id: "conv-1", ai_paused: false, status: "qualifying" }, error: null });
                }
                if (table === "messages" && q.op === "select") return resolve({ data: state.messages, error: null });
                if (table === "dm_drip_templates") {
                  return resolve({ data: { id: "tpl-1", content: "Still keen?", is_active: true }, error: null });
                }
                if (table === "dm_drip_queue" && q.op === "update") return resolve({ data: [{ id: "drip-1" }], error: null });
                if (table === "messages" && q.op === "insert") return resolve({ data: { id: "nudge-1" }, error: null });
                return resolve({ data: null, error: null });
              };
            }
            if (["insert", "update", "delete"].includes(prop)) return (payload) => ((q.op = prop), (q.payload = payload), b);
            return () => b;
          },
        }
      );
      return b;
    },
  };
}

vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin() }));
vi.mock("@/lib/drip/queue", () => ({ markDripStatus }));
vi.mock("@/lib/instagram", () => ({ sendInstagramMessage }));
vi.mock("@/lib/token-utils", () => ({ decryptToken }));
vi.mock("@/lib/prompts", () => ({ buildSystemPrompt: () => "prompt" }));
vi.mock("@/lib/anthropic", () => ({ generateReply: vi.fn(async () => "nudge") }));
vi.mock("@/lib/active-offer", () => ({ getActiveOffer: async () => null, ownerFromUser: () => ({}) }));
vi.mock("@/lib/reply-lint", () => ({ lintReply: (t) => ({ text: t }) }));
vi.mock("@/lib/posthog-server", () => ({ getPostHogClient: () => ({ capture: vi.fn() }) }));

const { processDrip } = await import("./processor");
const { lateDelivery, LATE_HOURS } = await import("@/lib/instagram/late-delivery.fixture");

const dripRow = { id: "drip-1", user_id: "user-1", conversation_id: "conv-1", recipient_psid: "lead", template_id: "tpl-1" };
const thread = (leadCreatedAt) => [
  // newest first, like the processor's query
  { id: "m2", role: "assistant", source: "agent", content: "What's your goal?", created_at: new Date().toISOString() },
  { id: "m1", role: "user", source: "lead", content: "hi", created_at: leadCreatedAt },
];

beforeEach(() => {
  markDripStatus.mockClear();
  sendInstagramMessage.mockClear();
});

describe("processDrip window check", () => {
  it(`a lead message Meta delivered ${LATE_HOURS}h late (stored with its send time) expires the nudge, nothing sent`, async () => {
    state.messages = thread(lateDelivery().storedCreatedAt);
    await processDrip(dripRow);
    expect(markDripStatus).toHaveBeenCalledWith("drip-1", "expired", { skipReason: "window_closing" });
    expect(sendInstagramMessage).not.toHaveBeenCalled();
  });

  it("control: a lead message from 2h ago sends the nudge", async () => {
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    state.messages = thread(at);
    const result = await processDrip(dripRow);
    expect(result).toEqual({ status: "fired" });
    expect(sendInstagramMessage).toHaveBeenCalledWith("igba", "lead", "Still keen?", "token", { lastInboundAt: at });
  });
});

describe("processDrip first-message disclosure claim", () => {
  const at = () => new Date(Date.now() - 2 * 3_600_000).toISOString();

  it("a drip that is the first thing sent on a persona account carries the disclosure", async () => {
    state.persona = true;
    state.conv.disclosed_at = null;
    state.messages = thread(at());
    await processDrip(dripRow);
    expect(sendInstagramMessage.mock.calls[0][2]).toBe("Hi! I'm Katlynne, Solé Aesthetics' AI concierge. Still keen?");
    expect(state.conv.disclosed_at).toBeTruthy();
    state.persona = false;
  });

  it("decrypt throws after the claim: the claim is released (audit)", async () => {
    state.persona = true;
    state.conv.disclosed_at = null;
    state.messages = thread(at());
    decryptToken.mockImplementationOnce(() => {
      throw new Error("bad key");
    });
    const result = await processDrip(dripRow);
    expect(result.status).toBe("error");
    expect(sendInstagramMessage).not.toHaveBeenCalled();
    expect(state.conv.disclosed_at).toBeNull();
    state.persona = false;
  });
});
