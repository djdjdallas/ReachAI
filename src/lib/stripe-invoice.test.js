import { describe, it, expect } from "vitest";
import {
  subscriptionIdFromInvoice,
  markPastDue,
  dunningEmailHtml,
} from "./stripe-invoice";
import { fakeSupabase } from "./test-utils/fake-supabase";

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

describe("markPastDue", () => {
  it("flips an active customer to past_due and returns the row for dunning", async () => {
    const db = fakeSupabase({
      users: [{ stripe_customer_id: "cus_a", subscription_status: "active", email: "a@x.com", full_name: "A" }],
    });
    expect(await markPastDue(db, "cus_a")).toEqual({ email: "a@x.com", full_name: "A" });
    expect(db.tables.users[0].subscription_status).toBe("past_due");
  });

  it("never resurrects a canceled customer (late final-invoice failure after deletion)", async () => {
    const db = fakeSupabase({
      users: [{ stripe_customer_id: "cus_c", subscription_status: "canceled", email: "c@x.com" }],
    });
    // null means no dunning email goes out either.
    expect(await markPastDue(db, "cus_c")).toBeNull();
    expect(db.tables.users[0].subscription_status).toBe("canceled");
  });
});

describe("dunningEmailHtml", () => {
  it("has no long dashes and names the billing link", () => {
    const html = dunningEmailHtml({ fullName: "Sam", billingUrl: "https://app/billing" });
    expect(html).not.toMatch(/[–—]/);
    expect(html).toContain("Hi Sam,");
    expect(html).toContain('href="https://app/billing"');
  });

  it("greets without a name", () => {
    expect(dunningEmailHtml({ fullName: null, billingUrl: "u" })).toContain("<p>Hi,</p>");
  });
});
