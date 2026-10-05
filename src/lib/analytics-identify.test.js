import { describe, it, expect, vi } from "vitest";
import { identifyUser } from "./analytics-identify";

function fakePosthog(distinctId) {
  return { get_distinct_id: vi.fn(() => distinctId), identify: vi.fn() };
}

describe("identifyUser", () => {
  it("identifies by Supabase user id with email as a person property", () => {
    const ph = fakePosthog("anon-123");
    expect(identifyUser(ph, { id: "uuid-1", email: "coach@example.com" })).toBe(true);
    expect(ph.identify).toHaveBeenCalledWith("uuid-1", { email: "coach@example.com" });
  });

  it("identifies a Google sign-in the same way (no auth-method branch)", () => {
    const ph = fakePosthog("anon-456");
    identifyUser(ph, { id: "uuid-2", email: "g@example.com", app_metadata: { provider: "google" } });
    expect(ph.identify).toHaveBeenCalledWith("uuid-2", { email: "g@example.com" });
  });

  it("does nothing when already identified as this user", () => {
    const ph = fakePosthog("uuid-1");
    expect(identifyUser(ph, { id: "uuid-1", email: "coach@example.com" })).toBe(false);
    expect(ph.identify).not.toHaveBeenCalled();
  });

  it("does nothing without a user", () => {
    const ph = fakePosthog("anon");
    expect(identifyUser(ph, null)).toBe(false);
    expect(identifyUser(null, { id: "x" })).toBe(false);
  });
});
