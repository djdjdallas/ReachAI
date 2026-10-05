import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn(async (args) => ({ id: "cs_1", url: "https://checkout", args }));
vi.mock("stripe", () => ({
  default: vi.fn(() => ({ checkout: { sessions: { create } } })),
}));

process.env.STRIPE_BASE_PRICE_ID = "price_base_env";
process.env.STRIPE_UNLIMITED_PRICE_ID = "price_unl_env";
process.env.NEXT_PUBLIC_APP_URL = "https://app.test";

const { createCheckoutSession, planForCheckout, PLANS } = await import("./stripe");

beforeEach(() => create.mockClear());

describe("planForCheckout (server-side plan validation)", () => {
  it("maps plan ids to env price ids and catalog prices", () => {
    expect(planForCheckout("base")).toMatchObject({ priceId: "price_base_env", price: 9700 });
    expect(planForCheckout("unlimited")).toMatchObject({ priceId: "price_unl_env", price: 19700 });
  });

  it.each(["", "pro", "constructor", "__proto__", "price_base_env", undefined])("rejects %j", (id) => {
    expect(planForCheckout(id)).toBeNull();
  });

  it("prices come from the catalog, not a local copy", () => {
    expect(Object.keys(PLANS)).toEqual(["base", "unlimited"]);
  });
});

describe("createCheckoutSession (card-required)", () => {
  it("new trial: 7 days, card always collected, userId on session and subscription", async () => {
    await createCheckoutSession("cus_1", "price_base_env", "user-1", { trialPeriodDays: 7 });
    const args = create.mock.calls[0][0];
    expect(args.mode).toBe("subscription");
    expect(args.payment_method_collection).toBe("always");
    expect(args.subscription_data).toEqual({ metadata: { userId: "user-1" }, trial_period_days: 7 });
    expect(args.metadata).toEqual({ userId: "user-1" });
    expect(args.success_url).toBe("https://app.test/choose-plan?checkout=success");
    expect(args.cancel_url).toBe("https://app.test/choose-plan");
  });

  it("legacy carry: trial_end only", async () => {
    await createCheckoutSession("cus_1", "price_base_env", "user-1", { trialEnd: 1790000000 });
    expect(create.mock.calls[0][0].subscription_data).toEqual({ metadata: { userId: "user-1" }, trial_end: 1790000000 });
  });

  it("no trial: neither field", async () => {
    await createCheckoutSession("cus_1", "price_base_env", "user-1", {});
    const sd = create.mock.calls[0][0].subscription_data;
    expect(sd).not.toHaveProperty("trial_period_days");
    expect(sd).not.toHaveProperty("trial_end");
  });

  it("refuses both trial options at once", async () => {
    await expect(
      createCheckoutSession("cus_1", "price_base_env", "user-1", { trialPeriodDays: 7, trialEnd: 1790000000 })
    ).rejects.toThrow(/exclusive/);
    expect(create).not.toHaveBeenCalled();
  });
});
