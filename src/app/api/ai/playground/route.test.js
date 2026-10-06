import { describe, it, expect, vi } from "vitest";

// Playground: the owner sees exactly what a lead would get. A handoff shows
// the fixed holding text plus why, never the model's own words. Real
// lintReply, so the fail-safe marker detection is what's under test.

const generateReply = vi.fn();

function admin() {
  return {
    from(table) {
      const b = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolve) => {
                if (table === "users") {
                  return resolve({
                    data: { id: "user-1", script_config: { greeting: "hey", offer: "coaching" }, calendly_url: "" },
                    error: null,
                  });
                }
                return resolve({ data: [], error: null });
              };
            }
            return () => b;
          },
        }
      );
      return b;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin() }));
vi.mock("@/lib/anthropic", () => ({ generateReply, OWNER_MANUAL_MARK: "[owner]", DRIP_MARK: "[drip]" }));
vi.mock("@/lib/rate-limit", () => ({ enforceAiRateLimit: async () => null }));

const { POST } = await import("./route");
const req = (text) =>
  new Request("https://app.test/api/ai/playground", {
    method: "POST",
    body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
  });

describe("POST /api/ai/playground knowledge handoff", () => {
  it("shows the holding text and the category, not the model's text", async () => {
    generateReply.mockResolvedValueOnce("Probably fine but <<HANDOFF:medical_question>>");
    const data = await (await POST(req("can i get botox while breastfeeding"))).json();
    expect(data).toEqual({
      reply: "Good question, let me check on that and get back to you.",
      hasBookingLink: false,
      handoff: "medical_question",
    });
  });

  it("a normal reply has no handoff field", async () => {
    generateReply.mockResolvedValueOnce("we train 4 days a week");
    const data = await (await POST(req("how many days a week do we train"))).json();
    expect(data.reply).toBe("we train 4 days a week");
    expect(data.handoff).toBeUndefined();
  });
});
