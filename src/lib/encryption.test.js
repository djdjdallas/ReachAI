import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "./encryption";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "c".repeat(64);
});

describe("encryption (aes-256-gcm)", () => {
  it("round-trips", () => {
    expect(decrypt(encrypt("whsec_abc"))).toBe("whsec_abc");
  });

  it("rejects a truncated auth tag (audit)", () => {
    const [iv, tag, ct] = encrypt("whsec_abc").split(":");
    expect(() => decrypt(`${iv}:${tag.slice(0, 8)}:${ct}`)).toThrow(/auth tag/);
    expect(() => decrypt(`${iv}:${tag.slice(0, 24)}:${ct}`)).toThrow(/auth tag/);
  });

  it("rejects a tampered ciphertext or tag", () => {
    const [iv, tag, ct] = encrypt("whsec_abc").split(":");
    const flip = (h) => (h[0] === "0" ? "1" : "0") + h.slice(1);
    expect(() => decrypt(`${iv}:${flip(tag)}:${ct}`)).toThrow();
    expect(() => decrypt(`${iv}:${tag}:${flip(ct)}`)).toThrow();
  });
});
