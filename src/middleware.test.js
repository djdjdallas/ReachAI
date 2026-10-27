import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/middleware", () => ({ updateSession: vi.fn() }));

const { config } = await import("./middleware.js");
const runsMiddleware = (path) => config.matcher.some((m) => new RegExp(`^${m}$`).test(path));

describe("middleware matcher", () => {
  it("skips the PostHog proxy so anonymous visitors' analytics are not redirected to /login", () => {
    expect(runsMiddleware("/ingest/static/array.js")).toBe(false);
    expect(runsMiddleware("/ingest/flags/")).toBe(false);
    expect(runsMiddleware("/ingest/e/")).toBe(false);
    expect(runsMiddleware("/ingest/i/v0/e/")).toBe(false);
  });

  it("still runs on app pages and APIs, including the outbound ingest API", () => {
    expect(runsMiddleware("/")).toBe(true);
    expect(runsMiddleware("/dashboard")).toBe(true);
    expect(runsMiddleware("/api/ingest/clinchd")).toBe(true);
    expect(runsMiddleware("/ingestion")).toBe(true);
  });
});
