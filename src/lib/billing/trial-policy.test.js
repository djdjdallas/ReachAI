import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  normalizeEmailForTrial,
  trialLedgerKey,
  decideCheckoutTrial,
  TRIAL_DAYS,
} from "./trial-policy";

const SECRET = "test-secret";
beforeEach(() => {
  process.env.TRIAL_LEDGER_SECRET = SECRET;
});

describe("normalizeEmailForTrial", () => {
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

describe("trialLedgerKey (HMAC-SHA256 of the normalized email)", () => {
  const hmac = (s) => createHmac("sha256", SECRET).update(s).digest("hex");

  it("hashes the normalized email, never storing the email", () => {
    const key = trialLedgerKey("Green.Evans97+promo@Gmail.com", SECRET);
    expect(key).toBe(hmac("greenevans97@gmail.com"));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("greenevans");
  });

  it("fixed test vector: changing the normalization or hash orphans every ledger row", () => {
    expect(trialLedgerKey("greenevans97@gmail.com", "test-secret")).toBe(
      "bde9108855568258f6b9ec231d35b83c88042c47a86d0964c434ed4bf211d6f7"
    );
  });

  it("every variant of one inbox gets the same key", () => {
    const keys = ["greenevans97@gmail.com", "Green.Evans97@googlemail.com", "greenevans97+x@gmail.com"].map((e) =>
      trialLedgerKey(e, SECRET)
    );
    expect(new Set(keys).size).toBe(1);
  });

  it("depends on the secret", () => {
    expect(trialLedgerKey("a@b.co", "one")).not.toBe(trialLedgerKey("a@b.co", "two"));
  });

  it("null for an unusable email; throws without a secret", () => {
    expect(trialLedgerKey("nope", SECRET)).toBeNull();
    expect(() => trialLedgerKey("a@b.co", "")).toThrow(/TRIAL_LEDGER_SECRET/);
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
    // Looked up by the HMAC of the normalized email, never the email.
    expect(d.eq).toHaveBeenCalledWith(
      "email_hash",
      createHmac("sha256", SECRET).update("newcoach@gmail.com").digest("hex")
    );
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
      ...deps({ ledger: { email_hash: "x".repeat(64) } }),
      now: NOW,
    });
    expect(r).toEqual({ mode: "none", reason: "email_had_trial" });
  });

  it("fails closed without TRIAL_LEDGER_SECRET", async () => {
    delete process.env.TRIAL_LEDGER_SECRET;
    const r = await decideCheckoutTrial({ user: newUser, customerId: "cus_new", ...deps(), now: NOW });
    expect(r).toEqual({ mode: "none", reason: "ledger_unavailable" });
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

describe("trialLedgerSecretFingerprint", async () => {
  const { trialLedgerSecretFingerprint } = await import("./trial-policy");
  it("is short, stable, secret-dependent, and never the secret", () => {
    const a = trialLedgerSecretFingerprint("secret-a");
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(trialLedgerSecretFingerprint("secret-a")).toBe(a);
    expect(trialLedgerSecretFingerprint("secret-b")).not.toBe(a);
    expect(a).not.toContain("secret");
  });
  it("null without a secret", () => {
    expect(trialLedgerSecretFingerprint("")).toBeNull();
  });
});

describe("recordTrialLedger (audit L1: throws so Stripe retries)", async () => {
  const { recordTrialLedger } = await import("./trial-policy");
  const admin = (error = null) => {
    const upsert = vi.fn(async () => ({ error }));
    return { from: vi.fn(() => ({ upsert })), upsert };
  };

  it("records the HMAC, never the email", async () => {
    const a = admin();
    await recordTrialLedger(a, { email: "New.Coach+x@gmail.com", stripeCustomerId: "cus_1", source: "stripe_checkout" });
    expect(a.upsert).toHaveBeenCalledWith(
      { email_hash: createHmac("sha256", SECRET).update("newcoach@gmail.com").digest("hex"), stripe_customer_id: "cus_1", source: "stripe_checkout" },
      { onConflict: "email_hash", ignoreDuplicates: true }
    );
  });

  it("throws when the write fails", async () => {
    await expect(
      recordTrialLedger(admin({ message: "timeout" }), { email: "a@b.co", stripeCustomerId: "cus_1", source: "x" })
    ).rejects.toThrow(/upsert failed: timeout/);
  });

  it("throws without TRIAL_LEDGER_SECRET", async () => {
    delete process.env.TRIAL_LEDGER_SECRET;
    const a = admin();
    await expect(recordTrialLedger(a, { email: "a@b.co", stripeCustomerId: "cus_1", source: "x" })).rejects.toThrow(
      /TRIAL_LEDGER_SECRET/
    );
    expect(a.upsert).not.toHaveBeenCalled();
  });

  it("an unusable email is skipped without throwing (a retry can't fix it)", async () => {
    const a = admin();
    await expect(recordTrialLedger(a, { email: null, stripeCustomerId: "cus_1", source: "x" })).resolves.toBeUndefined();
    expect(a.upsert).not.toHaveBeenCalled();
  });
});
