import { describe, it, expect, beforeEach } from "vitest";
import { isAuthorizedInternal } from "./cron-auth";

const req = (secret) => ({ headers: { get: (h) => (h === "x-internal-secret" ? secret : null) } });

describe("isAuthorizedInternal (audit L8)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret-value";
  });

  it("accepts only the exact secret", () => {
    expect(isAuthorizedInternal(req("s3cret-value"))).toBe(true);
    expect(isAuthorizedInternal(req("s3cret-valuX"))).toBe(false);
    expect(isAuthorizedInternal(req("s3cret"))).toBe(false);
    expect(isAuthorizedInternal(req(null))).toBe(false);
  });

  it("fails closed without CRON_SECRET, even for an empty header", () => {
    delete process.env.CRON_SECRET;
    expect(isAuthorizedInternal(req(""))).toBe(false);
    expect(isAuthorizedInternal(req("undefined"))).toBe(false);
  });
});
