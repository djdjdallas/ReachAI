import { describe, it, expect } from "vitest";
import { loadMonitoringByMediaId } from "./monitoring";

// A posts query stub: answers each select from `respond(cols)` and records
// the column lists it was asked for.
function stub(respond) {
  const asked = [];
  return {
    asked,
    from: () => {
      let cols = "";
      const b = {
        select: (c) => ((cols = c), b),
        eq: () => b,
        not: () => b,
        then: (resolve) => (asked.push(cols), resolve(respond(cols))),
      };
      return b;
    },
  };
}

const rows = (ms) => [{ id: "p1", ig_media_id: "m1", post_monitoring_settings: [ms] }, { id: "p2", ig_media_id: "m2", post_monitoring_settings: [] }];

describe("loadMonitoringByMediaId", () => {
  it("reads toggle state with the treatment tag", async () => {
    const admin = stub(() => ({ data: rows({ enabled: true, actions_per_class: null, treatment_key: "botox" }), error: null }));
    expect(await loadMonitoringByMediaId(admin, "u1")).toEqual({
      m1: { enabled: true, actions_per_class: null, treatment_key: "botox" },
    });
    expect(admin.asked).toHaveLength(1);
  });

  it("before migration 20261011120000 (42703): retries without treatment_key, tags read as null", async () => {
    const admin = stub((cols) =>
      /treatment_key/.test(cols)
        ? { data: null, error: { code: "42703", message: "column post_monitoring_settings_1.treatment_key does not exist" } }
        : { data: rows({ enabled: false, actions_per_class: { SPAM: "ignore" } }), error: null }
    );
    expect(await loadMonitoringByMediaId(admin, "u1")).toEqual({
      m1: { enabled: false, actions_per_class: { SPAM: "ignore" }, treatment_key: null },
    });
    expect(admin.asked).toHaveLength(2);
    expect(admin.asked[1]).not.toMatch(/treatment_key/);
  });

  it("another error does not retry", async () => {
    const admin = stub(() => ({ data: null, error: { code: "57014" } }));
    expect(await loadMonitoringByMediaId(admin, "u1")).toEqual({});
    expect(admin.asked).toHaveLength(1);
  });
});
