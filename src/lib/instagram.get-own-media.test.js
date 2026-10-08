import { describe, it, expect, vi, afterEach } from "vitest";
import { getOwnMedia } from "./instagram";

const reply = (body) => vi.spyOn(globalThis, "fetch").mockResolvedValue({ json: async () => body });
afterEach(() => vi.restoreAllMocks());

describe("getOwnMedia", () => {
  it("returns caption, permalink and type, reading with the account's token", async () => {
    const f = reply({ id: "m1", caption: "Botox week", permalink: "https://instagram.com/p/a", media_type: "IMAGE", owner: { id: "ig1" } });
    expect(await getOwnMedia("m1", "tok", "ig1")).toEqual({ caption: "Botox week", permalink: "https://instagram.com/p/a", media_type: "IMAGE" });
    expect(f.mock.calls[0][0]).toMatch(/graph\.instagram\.com\/v21\.0\/m1\?fields=id,caption,permalink,media_type,owner$/);
    expect(f.mock.calls[0][1]).toEqual({ headers: { Authorization: "Bearer tok" } });
  });
  it("no owner field: the successful read is the ownership check", async () => {
    reply({ id: "m1", caption: null });
    expect(await getOwnMedia("m1", "tok", "ig1")).toEqual({ caption: null, permalink: null, media_type: null });
  });
  it("null for another account's media, a Meta error, or a network failure", async () => {
    reply({ id: "m1", owner: { id: "someone-else" } });
    expect(await getOwnMedia("m1", "tok", "ig1")).toBeNull();
    vi.restoreAllMocks();
    reply({ error: { code: 100, message: "Unsupported get request" } });
    expect(await getOwnMedia("m1", "tok", "ig1")).toBeNull();
    vi.restoreAllMocks();
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect(await getOwnMedia("m1", "tok", "ig1")).toBeNull();
  });
});
