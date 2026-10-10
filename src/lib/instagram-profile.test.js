import { afterEach, describe, expect, it, vi } from "vitest";
import { getParticipantProfile } from "./instagram";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function graphReturns(body) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => body })));
}

describe("getParticipantProfile", () => {
  it("returns null and logs ig_profile_fetch_skipped when Meta requires consent", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    graphReturns({
      error: { message: "User consent is required to access user profile", type: "IGApiException", code: 230 },
    });

    await expect(getParticipantProfile("2909860736050862", "tok")).resolves.toBeNull();
    expect(JSON.parse(warn.mock.calls[0][0])).toEqual({
      event: "ig_profile_fetch_skipped",
      igsid: "2909860736050862",
      reason: "User consent is required to access user profile",
    });
    expect(error).not.toHaveBeenCalled();
  });

  it("returns null when the request itself fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    await expect(getParticipantProfile("123", "tok")).resolves.toBeNull();
  });

  it("still throws on a dead token (code 190) so the caller can flag a reconnect", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    graphReturns({ error: { message: "Error validating access token", type: "OAuthException", code: 190 } });
    await expect(getParticipantProfile("123", "tok")).rejects.toThrow("Failed to fetch participant profile");
  });

  it("returns the profile on success", async () => {
    graphReturns({ name: "Lead", username: "lead" });
    await expect(getParticipantProfile("123", "tok")).resolves.toEqual({ name: "Lead", username: "lead" });
  });
});
