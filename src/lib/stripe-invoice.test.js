import { describe, it, expect } from "vitest";
import { subscriptionIdFromInvoice } from "./stripe-invoice";

describe("subscriptionIdFromInvoice", () => {
  it("reads parent.subscription_details.subscription (API 2025-03-31 and later)", () => {
    // Shape of in_1UJmulGplBlBR1AHYTlvQjaL as returned on 2026-09-26.
    const invoice = {
      customer: "cus_x",
      parent: {
        type: "subscription_details",
        subscription_details: { subscription: "sub_new", metadata: {} },
      },
    };
    expect(subscriptionIdFromInvoice(invoice)).toBe("sub_new");
  });

  it("falls back to the legacy top-level field", () => {
    expect(subscriptionIdFromInvoice({ subscription: "sub_old" })).toBe("sub_old");
  });

  it("prefers parent when both are present", () => {
    expect(
      subscriptionIdFromInvoice({
        subscription: "sub_old",
        parent: { subscription_details: { subscription: "sub_new" } },
      })
    ).toBe("sub_new");
  });

  it("handles an expanded subscription object", () => {
    expect(
      subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: { id: "sub_exp" } } } })
    ).toBe("sub_exp");
  });

  it.each([
    [{ parent: { type: "quote_details", quote_details: {} } }],
    [{ parent: null }],
    [{}],
    [null],
  ])("returns null for a non-subscription invoice %j", (invoice) => {
    expect(subscriptionIdFromInvoice(invoice)).toBeNull();
  });
});
