import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Analytics is a side effect: no method of the server client may throw,
// reject or hang its caller.

const ctor = vi.fn();
vi.mock("posthog-node", () => ({
  PostHog: function (...args) {
    return ctor(...args);
  },
}));

let errorSpy;
let warnSpy;
beforeEach(() => {
  vi.resetModules();
  ctor.mockReset();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
  vi.useRealTimers();
  delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
});

const load = () => import("./posthog-server");

describe("getPostHogClient", () => {
  it("no key: a no-op client, warned once, SDK never constructed", async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    const { getPostHogClient } = await load();
    expect(() => getPostHogClient().capture({ distinctId: "u", event: "e" })).not.toThrow();
    await expect(getPostHogClient().captureImmediate({ distinctId: "u", event: "e" })).resolves.toBeUndefined();
    await expect(getPostHogClient().shutdown()).resolves.toBeUndefined();
    expect(ctor).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("SDK constructor throws: analytics disabled, nothing thrown", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    ctor.mockImplementation(() => {
      throw new Error("bad config");
    });
    const { getPostHogClient } = await load();
    expect(() => getPostHogClient().capture({ distinctId: "u", event: "e" })).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("init failed"), "bad config");
  });

  it("capture throwing is caught and logged with the event name", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    ctor.mockImplementation(() => ({
      capture: () => {
        throw new Error("boom");
      },
    }));
    const { getPostHogClient } = await load();
    expect(() => getPostHogClient().capture({ distinctId: "u", event: "subscription_activated" })).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith("[analytics] capture subscription_activated failed:", "boom");
  });

  it("captureImmediate / flush / shutdown rejecting resolve instead", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    const fail = () => Promise.reject(new Error("ECONNRESET"));
    ctor.mockImplementation(() => ({ captureImmediate: fail, flush: fail, shutdown: fail }));
    const { getPostHogClient } = await load();
    const c = getPostHogClient();
    await expect(c.captureImmediate({ distinctId: "u", event: "account_deleted" })).resolves.toBeUndefined();
    await expect(c.flush()).resolves.toBeUndefined();
    await expect(c.shutdown()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(3);
  });

  it("a hung network call gives up after the timeout", async () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    ctor.mockImplementation(() => ({ flush: () => new Promise(() => {}) }));
    const { getPostHogClient, ANALYTICS_TIMEOUT_MS } = await load();
    const p = getPostHogClient().flush();
    await vi.advanceTimersByTimeAsync(ANALYTICS_TIMEOUT_MS);
    await expect(p).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith("[analytics] flush failed:", expect.stringContaining("timed out"));
  });

  it("healthy calls pass through", async () => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    const capture = vi.fn();
    ctor.mockImplementation(() => ({ capture }));
    const { getPostHogClient } = await load();
    getPostHogClient().capture({ distinctId: "u", event: "e" });
    expect(capture).toHaveBeenCalledWith({ distinctId: "u", event: "e" });
  });
});
