import { describe, it, expect } from "vitest";
import { postStateFor, AUTO_WATCH_STATE } from "./post-state";

const saved = { m1: { enabled: false, actions_per_class: null, treatment_key: null } };

describe("postStateFor", () => {
  it("managed accounts: a post with no row shows as watched with the defaults", () => {
    expect(postStateFor("m2", { overrides: {}, monitoringByMediaId: saved, autoWatch: true })).toBe(AUTO_WATCH_STATE);
  });
  it("a saved row wins, so a post turned off shows off", () => {
    expect(postStateFor("m1", { overrides: {}, monitoringByMediaId: saved, autoWatch: true })).toEqual(saved.m1);
  });
  it("this session's change wins over both", () => {
    const o = { m1: { enabled: true, actions_per_class: null, treatment_key: "botox" } };
    expect(postStateFor("m1", { overrides: o, monitoringByMediaId: saved, autoWatch: true })).toBe(o.m1);
  });
  it("coach accounts: a post with no row is not watched (unchanged)", () => {
    expect(postStateFor("m2", { overrides: {}, monitoringByMediaId: saved, autoWatch: false })).toBeNull();
  });
});
