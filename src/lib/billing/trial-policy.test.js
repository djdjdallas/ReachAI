import { describe, it, expect, vi } from "vitest";
import { normalizeEmailForTrial, decideCheckoutTrial, TRIAL_DAYS } from "./trial-policy";

// Same inputs/outputs as public.normalize_email_for_trial (migration
// 20261006130000), checked against Postgres 17: the two must agree.
describe("normalizeEmailForTrial (parity with the SQL function)", () => {
  it.each([
    ["Green.Evans97+x@Gmail.com", "greenevans97@gmail.com"],
    ["greenevans97@googlemail.com", "greenevans97@gmail.com"],
    ["dominickjerell+smoke1@gmail.com", "dominickjerell@gmail.com"],
    ["coaching@kultivateher.com", "coaching@kultivateher.com"],
    ["a.b+c@Example.COM", "a.b@example.com"],
    [" x@y.io ", "x@y.io"],
    ["nope", null],
    ["@gmail.com", null],
    ["+tag@gmail.com", null],
    [null, null],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeEmailForTrial(input)).toBe(expected);
  });
});

const NOW = Date.parse("2026-10-06T12:00:00Z");
const H = 60 * 60 * 1000;

function deps({ subs = [], ledger = null, ledgerError = null } = {}) {
  const stripe = { subscriptions: { list: vi.fn(async () => ({ data: subs })) } };
  const maybeSingle = vi.fn(async () => ({ data: ledger, error: ledgerError }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const admin = { from: vi.fn(() => ({ select: () => ({ eq }) })) };
  return { stripe, admin, eq };
}

const newUser = { email: "new.coach+ig@gmail.com", subscription_status: "inactive", trial_ends_at: null, stripe_subscription_id: null };

describe("decideCheckoutTrial", () => {
  it("a new person gets the 7-day trial", async () => {
    const d = deps();
    expect(await decideCheckoutTrial({ user: newUser, customerId: "cus_new", ...d, now: NOW })).toEqual({
      mode: "trial",
      trialPeriodDays: TRIAL_DAYS,
    });
    // Looked up by the normalized email.
    expect(d.eq).toHaveBeenCalledWith("normalized_email", "newcoach@gmail.com");
  });

  it("legacy trial still running (>=49h): carries the remaining days (decision B)", async () => {
    const d = deps();
    const end = new Date(NOW + 72 * H).toISOString();
    const r = await decideCheckoutTrial({
      user: { ...newUser, subscription_status: "trialing", trial_ends_at: end },
      customerId: "cus_x",
      ...d,
      now: NOW,
    });
    expect(r).toEqual({ mode: "carry", trialEnd: Math.floor(Date.parse(end) / 1000) });
    expect(d.stripe.subscriptions.list).not.toHaveBeenCalled();
  });

  it("legacy trial ended: no trial, charge today", async () => {
    const r = await decideCheckoutTrial({
      user: { ...newUser, subscription_status: "trialing", trial_ends_at: new Date(NOW - H).toISOString() },
      customerId: "cus_x",
      ...deps(),
      now: NOW,
    });
    expect(r).toEqual({ mode: "none", reason: "legacy_trial_used" });
  });

  it("this customer ever had a subscription (even a canceled trial): no trial", async () => {
    const r = await decideCheckoutTrial({
      user: newUser,
      customerId: "cus_old",
      ...deps({ subs: [{ id: "sub_1", status: "canceled" }] }),
      now: NOW,
    });
    expect(r).toEqual({ mode: "none", reason: "customer_had_subscription" });
  });

  it("deleted account re-signing up: the email is in the ledger, no trial", async () => {
    const r = await decideCheckoutTrial({
      user: { ...newUser, email: "Green.Evans97@gmail.com" },
      customerId: "cus_brand_new",
      ...deps({ ledger: { normalized_email: "greenevans97@gmail.com" } }),
      now: NOW,
    });
    expect(r).toEqual({ mode: "none", reason: "email_had_trial" });
  });

  it("fails closed when the ledger can't be read", async () => {
    const r = await decideCheckoutTrial({
      user: newUser,
      customerId: "cus_new",
      ...deps({ ledgerError: { message: "down" } }),
      now: NOW,
    });
    expect(r).toEqual({ mode: "none", reason: "ledger_unavailable" });
  });
});
