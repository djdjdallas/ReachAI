import { describe, it, expect, vi, afterEach } from "vitest";
import { getOwnMedia } from "./instagram";

// Realistic Graph responses for GET graph.instagram.com/v21.0/{media-id}
// with an Instagram User token (Business Login for Instagram). On the
// account's own media Meta returns `owner` with the APP-SCOPED user id (the
// 269... id /me returns as `id`), not the professional account id the
// webhook carries (17841..., /me `user_id`). The old check compared the
// two, so every read returned null without a log (live: comment
// 18118746053059317, 2026-10-08).
const IGBA = "17841400000000001"; // webhook entry.id, users.instagram_business_account_id
const APP_SCOPED = "26912345678901234"; // /me id
const ACCOUNT = { igAccountId: IGBA, username: "soleaesthetics" };
const OWN = {
  id: "18045632109876543",
  caption: "Grand Opening.. Comment Botox for 10% off",
  permalink: "https://www.instagram.com/p/DPq1AbCdEfG/",
  media_type: "IMAGE",
  owner: { id: APP_SCOPED },
};

function reply(body, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}
const warns = () => vi.mocked(console.warn).mock.calls;

afterEach(() => vi.restoreAllMocks());

describe("getOwnMedia", () => {
  it("the account's own media (owner id is app-scoped, not the webhook id): caption, permalink, type", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = reply(OWN);
    expect(await getOwnMedia(OWN.id, "IGAAtoken", ACCOUNT)).toEqual({
      caption: "Grand Opening.. Comment Botox for 10% off",
      permalink: "https://www.instagram.com/p/DPq1AbCdEfG/",
      media_type: "IMAGE",
    });
    expect(f.mock.calls[0][0]).toBe(`https://graph.instagram.com/v21.0/${OWN.id}?fields=id,caption,permalink,media_type,owner,username`);
    expect(f.mock.calls[0][1]).toEqual({ headers: { Authorization: "Bearer IGAAtoken" } });
    expect(warns()).toHaveLength(0);
  });

  it("someone else's media: Meta returns username instead of owner; logged with both usernames", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    reply({ id: "18000000000000001", caption: "theirs", media_type: "IMAGE", username: "otherclinic" });
    expect(await getOwnMedia("18000000000000001", "IGAAtoken", ACCOUNT)).toBeNull();
    expect(warns()[0]).toEqual([
      "[getOwnMedia] not the account's media",
      { mediaId: "18000000000000001", igAccountId: IGBA, ownerId: null, mediaUsername: "otherclinic", accountUsername: "soleaesthetics" },
    ]);
  });

  it("no owner but the account's own username still counts", async () => {
    reply({ ...OWN, owner: undefined, username: "SoleAesthetics" });
    expect(await getOwnMedia(OWN.id, "IGAAtoken", ACCOUNT)).toMatchObject({ caption: OWN.caption });
  });

  it("a Meta error: logged with status and code, never the token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    reply({ error: { message: "Unsupported get request.", type: "IGApiException", code: 100, error_subcode: 33, fbtrace_id: "x" } }, 400);
    expect(await getOwnMedia(OWN.id, "IGAAsecret", ACCOUNT)).toBeNull();
    expect(warns()[0]).toEqual([
      "[getOwnMedia] Meta error",
      { mediaId: OWN.id, igAccountId: IGBA, status: 400, code: 100, subcode: 33, type: "IGApiException", message: "Unsupported get request." },
    ]);
    expect(JSON.stringify(warns())).not.toContain("IGAAsecret");
  });

  it("a non-JSON or empty response, a network failure, or no token: logged, null", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("not json"); } });
    expect(await getOwnMedia(OWN.id, "t", ACCOUNT)).toBeNull();
    expect(warns().at(-1)).toEqual(["[getOwnMedia] unexpected response", { mediaId: OWN.id, igAccountId: IGBA, status: 502, hasBody: false }]);

    vi.mocked(globalThis.fetch).mockRejectedValue(new Error("ECONNRESET"));
    expect(await getOwnMedia(OWN.id, "t", ACCOUNT)).toBeNull();
    expect(warns().at(-1)).toEqual(["[getOwnMedia] network error", { mediaId: OWN.id, igAccountId: IGBA, error: "ECONNRESET" }]);

    vi.mocked(globalThis.fetch).mockClear();
    expect(await getOwnMedia(OWN.id, null, ACCOUNT)).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(warns().at(-1)).toEqual(["[getOwnMedia] no access token", { mediaId: OWN.id, igAccountId: IGBA }]);
  });
});
