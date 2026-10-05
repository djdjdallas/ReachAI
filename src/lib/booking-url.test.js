import { describe, it, expect } from "vitest";
import { normalizeBookingUrl, BOOKING_URL_MAX } from "./booking-url";

describe("normalizeBookingUrl", () => {
  it("blank becomes null", () => {
    expect(normalizeBookingUrl("")).toEqual({ ok: true, value: null });
    expect(normalizeBookingUrl("   ")).toEqual({ ok: true, value: null });
    expect(normalizeBookingUrl(null)).toEqual({ ok: true, value: null });
  });
  it("keeps https", () => {
    expect(normalizeBookingUrl(" https://calendly.com/x/15min ").value).toBe("https://calendly.com/x/15min");
  });
  it("upgrades http and adds a missing scheme", () => {
    expect(normalizeBookingUrl("http://calendly.com/x").value).toBe("https://calendly.com/x");
    expect(normalizeBookingUrl("calendly.com/x").value).toBe("https://calendly.com/x");
  });
  it("rejects spaces and overlong links", () => {
    expect(normalizeBookingUrl("https://calendly.com/a b").ok).toBe(false);
    expect(normalizeBookingUrl(`https://${"a".repeat(BOOKING_URL_MAX)}`).ok).toBe(false);
  });
});
