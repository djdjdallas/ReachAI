import { afterEach, describe, expect, it, vi } from "vitest";
import { pingHeartbeat } from "./heartbeat";

afterEach(() => vi.unstubAllGlobals());

describe("pingHeartbeat", () => {
  it("is a no-op when the url is unset", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await pingHeartbeat(undefined);
    await pingHeartbeat("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pings the url, and url/fail on failure", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await pingHeartbeat("https://hc.example/abc");
    await pingHeartbeat("https://hc.example/abc", { fail: true });
    expect(fetchMock.mock.calls[0][0]).toBe("https://hc.example/abc");
    expect(fetchMock.mock.calls[1][0]).toBe("https://hc.example/abc/fail");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("resolves without throwing when the ping fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    await expect(pingHeartbeat("https://hc.example/abc")).resolves.toBeUndefined();
  });

  it("resolves without throwing against a real unreachable host", async () => {
    await expect(pingHeartbeat("http://127.0.0.1:1")).resolves.toBeUndefined();
  });
});
