import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

const getOwnMedia = vi.fn();
vi.mock("@/lib/instagram", () => ({ getOwnMedia }));
const { isAutoWatchAccount, isAdComment, ingestOwnedPost, autoWatchPost } = await import("./comment-auto-watch");

const MEDIA = { caption: "Lip filler week", permalink: "https://instagram.com/p/x", media_type: "VIDEO" };
beforeEach(() => {
  getOwnMedia.mockReset();
  getOwnMedia.mockResolvedValue(MEDIA);
});

describe("isAutoWatchAccount", () => {
  it("only billing_managed = true", () => {
    expect(isAutoWatchAccount({ billing_managed: true })).toBe(true);
    expect(isAutoWatchAccount({ billing_managed: false })).toBe(false);
    expect(isAutoWatchAccount({})).toBe(false);
    expect(isAutoWatchAccount(null)).toBe(false);
  });
});

describe("isAdComment", () => {
  it.each([
    [{ id: "m1" }, false],
    [{ id: "m1", original_media_id: "m1" }, false],
    [{ id: "ad", original_media_id: "m1" }, true],
    [{ id: "ad", ad_id: "1202" }, true],
    [null, false],
  ])("%j → %s", (media, expected) => {
    expect(isAdComment(media)).toBe(expected);
  });
});

describe("ingestOwnedPost", () => {
  const args = { creatorId: "u1", mediaId: "m-org", account: { igAccountId: "ig1", username: "clinic" }, token: "tok" };

  it("creates the post with Meta's metadata when it is the account's own", async () => {
    const db = fakeDb({ posts: [] }, { unique: { posts: "ig_media_id" } });
    const row = await ingestOwnedPost(db, args);
    expect(getOwnMedia).toHaveBeenCalledWith("m-org", "tok", { igAccountId: "ig1", username: "clinic" });
    expect(row).toMatchObject({ creator_id: "u1", ig_media_id: "m-org", caption: "Lip filler week" });
    expect(db.tables.posts[0]).toMatchObject({ permalink: "https://instagram.com/p/x", media_type: "VIDEO" });
  });
  it("null when Meta won't confirm it, there's no token, or the insert conflicts", async () => {
    const db = fakeDb({ posts: [{ id: "p-x", creator_id: "other", ig_media_id: "m-org" }] }, { unique: { posts: "ig_media_id" } });
    expect(await ingestOwnedPost(db, args)).toBeNull();
    getOwnMedia.mockResolvedValueOnce(null);
    expect(await ingestOwnedPost(fakeDb({ posts: [] }), args)).toBeNull();
    // No token: getOwnMedia logs it and returns null.
    getOwnMedia.mockResolvedValueOnce(null);
    expect(await ingestOwnedPost(fakeDb({ posts: [] }), { ...args, token: null })).toBeNull();
    expect(getOwnMedia).toHaveBeenLastCalledWith("m-org", null, args.account);
  });
});

describe("autoWatchPost", () => {
  const setup = (rows = []) =>
    fakeDb({ posts: [{ id: "p1", creator_id: "u1", ig_media_id: "m1", caption: null }], post_monitoring_settings: rows });

  it("fills a missing caption and creates the default monitoring row", async () => {
    const db = setup();
    const post = await autoWatchPost(db, { creatorId: "u1", postRow: db.tables.posts[0], account: { igAccountId: "ig1" }, token: "tok" });
    expect(post.caption).toBe("Lip filler week");
    expect(db.tables.posts[0]).toMatchObject({ caption: "Lip filler week", permalink: "https://instagram.com/p/x" });
    expect(db.tables.post_monitoring_settings).toEqual([
      expect.objectContaining({ creator_id: "u1", post_id: "p1", enabled: true, actions_per_class: null }),
    ]);
  });
  it("a post with a caption is not re-read from Meta", async () => {
    const db = setup();
    await autoWatchPost(db, { creatorId: "u1", postRow: { ...db.tables.posts[0], caption: "known" }, account: { igAccountId: "ig1" }, token: "tok" });
    expect(getOwnMedia).not.toHaveBeenCalled();
  });
  it("a row created first by a concurrent comment is left alone (even one turned off)", async () => {
    const db = setup([{ id: "ms1", creator_id: "u1", post_id: "p1", enabled: false, actions_per_class: null }]);
    await autoWatchPost(db, { creatorId: "u1", postRow: db.tables.posts[0], account: { igAccountId: "ig1" }, token: "tok" });
    expect(db.tables.post_monitoring_settings).toEqual([expect.objectContaining({ id: "ms1", enabled: false })]);
  });
  it("never throws", async () => {
    getOwnMedia.mockRejectedValueOnce(new Error("boom"));
    const db = setup();
    await expect(autoWatchPost(db, { creatorId: "u1", postRow: db.tables.posts[0], account: { igAccountId: "ig1" }, token: "tok" })).resolves.toMatchObject({ id: "p1" });
  });
});
