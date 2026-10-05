import { describe, it, expect, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));

const { canUseCommentToDM } = await import("@/lib/comment-to-dm-gate");
const { canUseVoiceReplies, canUseDripSequences } = await import("@/lib/plan");
const { reachableWithoutAccess } = await import("@/lib/supabase/middleware");

const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
const past = new Date(Date.now() - 30 * 86_400_000).toISOString();

const unlimitedPaying = {
  email: "coach@example.com",
  plan: "unlimited",
  subscription_status: "active",
  stripe_subscription_id: "sub_1",
  trial_ends_at: null,
  current_period_end: future,
};

describe("feature gates use hasActiveAccess (no founder bypass)", () => {
  it.each([
    ["canUseCommentToDM", canUseCommentToDM],
    ["canUseVoiceReplies", canUseVoiceReplies],
    ["canUseDripSequences", canUseDripSequences],
  ])("%s: unlimited + access allowed; no access or base denied", (_n, gate) => {
    expect(gate(unlimitedPaying)).toBe(true);
    expect(gate({ ...unlimitedPaying, subscription_status: "canceled" })).toBe(false);
    expect(gate({ ...unlimitedPaying, plan: "base" })).toBe(false);
  });

  it.each([
    ["canUseCommentToDM", canUseCommentToDM],
    ["canUseVoiceReplies", canUseVoiceReplies],
    ["canUseDripSequences", canUseDripSequences],
  ])("%s: the founder email alone grants nothing", (_n, gate) => {
    expect(
      gate({
        ...unlimitedPaying,
        email: "dominickjerell@gmail.com",
        subscription_status: "trialing",
        stripe_subscription_id: null,
        trial_ends_at: past,
      })
    ).toBe(false);
  });

  it("a comped founder row has access the normal way", () => {
    expect(
      canUseCommentToDM({
        ...unlimitedPaying,
        email: "dominickjerell@gmail.com",
        stripe_subscription_id: null,
        trial_ends_at: "2099-12-31T23:59:59Z",
      })
    ).toBe(true);
  });

  it("a row without the access columns is denied (old 'plan, email' selects)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(canUseCommentToDM({ plan: "unlimited", email: "coach@example.com" })).toBe(false);
    spy.mockRestore();
  });
});

describe("middleware paywall allowlist", () => {
  it.each(["/choose-plan", "/billing", "/billing/success", "/api/stripe/create-checkout", "/api/stripe/create-portal", "/api/billing/access", "/api/user/delete"])(
    "%s is reachable without access",
    (p) => expect(reachableWithoutAccess(p)).toBe(true)
  );

  it.each(["/dashboard", "/onboarding", "/settings", "/conversations", "/api/auth/instagram", "/api/users/ai-mode", "/api/ai/reply", "/billingx"])(
    "%s is not",
    (p) => expect(reachableWithoutAccess(p)).toBe(false)
  );
});
