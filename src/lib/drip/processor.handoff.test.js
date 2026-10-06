import { describe, it, expect, vi } from "vitest";

// Drip nudge composed by the model (no template) that comes back as a
// knowledge-handoff marker: skipped, nothing sent. Uses the real lintReply
// so the fail-safe marker detection is what's under test.

const markDripStatus = vi.fn(async (id, status, extra) => ({ status, ...extra }));
const sendInstagramMessage = vi.fn(async () => ({ message_id: "mid.drip" }));
const generateReply = vi.fn(async () => "Hey! <<HANDOFF:missing_knowledge>>");
const leadAt = new Date(Date.now() - 2 * 3_600_000).toISOString();

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
                    },
                    error: null,
                  });
                }
                if (table === "conversations") {
                  return resolve({ data: { id: "conv-1", ai_paused: false, status: "qualifying" }, error: null });
                }
                if (table === "messages" && q.op === "select") {
                  return resolve({
                    data: [
                      { id: "m2", role: "assistant", source: "agent", content: "What's your goal?", created_at: new Date().toISOString() },
                      { id: "m1", role: "user", source: "lead", content: "hi", created_at: leadAt },
                    ],
                    error: null,
                  });
                }
                if (table === "knowledge_entries") return resolve({ data: [], error: null });
                return resolve({ data: null, error: null });
              };
            }
            if (["insert", "update", "delete"].includes(prop)) return () => ((q.op = prop), b);
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
vi.mock("@/lib/token-utils", () => ({ decryptToken: () => "token" }));
vi.mock("@/lib/prompts", () => ({ buildSystemPrompt: () => "prompt" }));
vi.mock("@/lib/anthropic", () => ({ generateReply }));
vi.mock("@/lib/active-offer", () => ({ getActiveOffer: async () => null, ownerFromUser: () => ({}) }));
vi.mock("@/lib/posthog-server", () => ({ getPostHogClient: () => ({ capture: vi.fn() }) }));

const { processDrip } = await import("./processor");

describe("processDrip knowledge handoff", () => {
  it("a generated nudge that hands off is skipped as handoff_required; nothing is sent", async () => {
    await processDrip({ id: "drip-1", user_id: "user-1", conversation_id: "conv-1", recipient_psid: "lead", template_id: null });
    expect(generateReply).toHaveBeenCalled();
    expect(markDripStatus).toHaveBeenCalledWith("drip-1", "skipped", { skipReason: "handoff_required" });
    expect(sendInstagramMessage).not.toHaveBeenCalled();
  });
});
