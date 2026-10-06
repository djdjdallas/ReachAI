import { describe, it, expect } from "vitest";
import {
  isBlockedAddress,
  parseDestinationUrl,
  resolvePublic,
  assertSafeDestination,
  safeLookup,
} from "./ssrf";

describe("isBlockedAddress", () => {
  it.each([
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.1",
    "127.0.0.1",
    "127.8.8.8",
    "169.254.169.254", // cloud metadata
    "169.254.0.1",
    "100.64.0.1", // CGNAT
    "100.127.255.255",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd00:ec2::254", // AWS metadata over IPv6
    "fe80::1",
    "fe80::1%eth0",
    "ff02::1",
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:7f00:1", // same, hex form
    "::ffff:169.254.169.254",
    "::ffff:10.0.0.1",
    "64:ff9b::a9fe:a9fe", // NAT64 of 169.254.169.254
    "2002:a9fe:a9fe::1", // 6to4 of 169.254.169.254
    "2001:db8::1",
    "::127.0.0.1", // deprecated IPv4-compatible
    "not-an-ip",
    "",
  ])("blocks %s", (addr) => {
    expect(isBlockedAddress(addr)).toBe(true);
  });

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111", "2a00:1450:4001::200e", "::ffff:8.8.8.8"])(
    "allows public %s",
    (addr) => {
      expect(isBlockedAddress(addr)).toBe(false);
    }
  );
});

describe("parseDestinationUrl", () => {
  it("accepts a plain https URL", () => {
    expect(parseDestinationUrl("https://app.mararue.com/api/ingest/clinchd").hostname).toBe("app.mararue.com");
  });

  it.each([
    ["http://app.mararue.com/x", "https_required"],
    ["ftp://x.example/x", "https_required"],
    ["https://user:pw@app.mararue.com/x", "credentials_not_allowed"],
    ["https://app.mararue.com:8443/x", "port_not_allowed"],
    ["https://127.0.0.1/x", "address_blocked"],
    ["https://[::1]/x", "address_blocked"],
    ["https://169.254.169.254/latest/meta-data", "address_blocked"],
    ["https://localhost/x", "address_blocked"],
    ["https://metadata/x", "address_blocked"],
    ["not a url", "url_invalid"],
    [`https://x.example/${"a".repeat(2100)}`, "url_too_long"],
  ])("rejects %s (%s)", (url, code) => {
    expect(() => parseDestinationUrl(url)).toThrow(expect.objectContaining({ code }));
  });
});

describe("resolvePublic", () => {
  const lookup = (answers) => async () => answers;

  it("passes when every address is public", async () => {
    await expect(resolvePublic("hooks.example.com", lookup([{ address: "93.184.216.34", family: 4 }]))).resolves.toHaveLength(1);
  });

  it("fails when ANY address is private (mixed answers)", async () => {
    await expect(
      resolvePublic("hooks.example.com", lookup([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }]))
    ).rejects.toMatchObject({ code: "address_blocked" });
  });

  it("fails on a name that resolves to metadata", async () => {
    await expect(resolvePublic("evil.example.com", lookup([{ address: "169.254.169.254", family: 4 }]))).rejects.toMatchObject({
      code: "address_blocked",
    });
  });

  it("fails closed on DNS errors and empty answers", async () => {
    await expect(resolvePublic("x.example", async () => Promise.reject(Object.assign(new Error("x"), { code: "ENOTFOUND" })))).rejects.toMatchObject({
      code: "dns_failed",
    });
    await expect(resolvePublic("x.example", lookup([]))).rejects.toMatchObject({ code: "dns_failed" });
  });

  it("config-time check combines the static and DNS rules", async () => {
    await expect(assertSafeDestination("https://hooks.example.com/x", lookup([{ address: "127.0.0.1", family: 4 }]))).rejects.toMatchObject({
      code: "address_blocked",
    });
    await expect(assertSafeDestination("http://hooks.example.com/x", lookup([{ address: "93.184.216.34", family: 4 }]))).rejects.toMatchObject({
      code: "https_required",
    });
  });
});

describe("safeLookup (connect-time check)", () => {
  it("refuses IP-literal loopback via the same resolver", async () => {
    const err = await new Promise((resolve) => safeLookup("127.0.0.1", {}, (e) => resolve(e)));
    expect(err?.code).toBe("address_blocked");
  });

  it("returns the all-form when asked", async () => {
    const res = await new Promise((resolve) => safeLookup("8.8.8.8", { all: true }, (e, a) => resolve([e, a])));
    expect(res).toEqual([null, [{ address: "8.8.8.8", family: 4 }]]);
  });
});
