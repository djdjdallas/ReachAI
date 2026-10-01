import { describe, it, expect } from "vitest";
import {
  planCheckoutTrial,
  MIN_TRIAL_LEAD_MS,
  formatPrice,
  chargeTodayText,
  trialContinuesText,
} from "./checkout-trial";

const NOW = Date.parse("2026-09-26T04:08:43Z");
const H = 60 * 60 * 1000;

describe("planCheckoutTrial", () => {
  it("carries the remaining in-app trial into Stripe, ending exactly at trial_ends_at", () => {
    // The 2026-09-26 customer: signed up 09-25 16:24, paid 09-26 04:08.
    const trialEndsAt = "2026-10-02T16:24:10.331Z";
    const r = planCheckoutTrial({ subscriptionStatus: "trialing", trialEndsAt, now: NOW });
    expect(r.chargeToday).toBe(false);
    expect(r.trialEnd).toBe(Math.floor(Date.parse(trialEndsAt) / 1000));
  });

  it("never grants more trial than remains (rounds down to the second)", () => {
    const trialEndsAt = new Date(NOW + 72 * H + 999).toISOString();
    const r = planCheckoutTrial({ subscriptionStatus: "trialing", trialEndsAt, now: NOW });
    expect(r.trialEnd * 1000).toBeLessThanOrEqual(Date.parse(trialEndsAt));
  });

  it("charges today when less than the 49h minimum remains", () => {
    const trialEndsAt = new Date(NOW + MIN_TRIAL_LEAD_MS - 1).toISOString();
    expect(planCheckoutTrial({ subscriptionStatus: "trialing", trialEndsAt, now: NOW })).toEqual({
      trialEnd: null,
      chargeToday: true,
    });
  });

  it("carries a trial at exactly the minimum", () => {
    const trialEndsAt = new Date(NOW + MIN_TRIAL_LEAD_MS).toISOString();
    expect(planCheckoutTrial({ subscriptionStatus: "trialing", trialEndsAt, now: NOW }).chargeToday).toBe(false);
  });

  it.each([
    ["expired trial", "trialing", new Date(NOW - H).toISOString()],
    ["no trial date", "trialing", null],
    ["status expired", "expired", new Date(NOW + 100 * H).toISOString()],
    ["status canceled", "canceled", new Date(NOW + 100 * H).toISOString()],
    ["comped active row with far-future date", "active", "2099-12-31T00:00:00Z"],
    ["trialing row beyond Stripe's 730-day cap", "trialing", "2099-12-31T00:00:00Z"],
  ])("charges today: %s", (_label, subscriptionStatus, trialEndsAt) => {
    expect(planCheckoutTrial({ subscriptionStatus, trialEndsAt, now: NOW })).toEqual({
      trialEnd: null,
      chargeToday: true,
    });
  });
});

describe("copy", () => {
  it("formats prices", () => {
    expect(formatPrice(19700)).toBe("$197");
    expect(formatPrice(9799)).toBe("$97.99");
  });

  it("says the exact charge-today line", () => {
    expect(chargeTodayText(19700)).toBe("You'll be charged $197 today.");
  });

  it("names the trial end date", () => {
    const end = Math.floor(Date.parse("2026-10-02T16:24:10Z") / 1000);
    expect(trialContinuesText(end, 19700)).toBe(
      "Your free trial continues until October 2. You won't be charged $197 until then."
    );
  });

  it("has no long dashes", () => {
    expect(chargeTodayText(9700) + trialContinuesText(1790000000, 9700)).not.toMatch(/[–—]/);
  });
});
