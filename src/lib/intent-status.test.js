import { describe, it, expect } from "vitest";
import {
  statusForIntent,
  STATUS_PROMOTION_THRESHOLD,
  DO_NOT_SEND_COLD_THRESHOLD,
} from "./intent-status";
import { DO_NOT_SEND_PAUSE_THRESHOLD } from "./dm-intent";

describe("statusForIntent", () => {
  it.each([
    ["warm_intent", 0.9, "qualifying"],
    ["booking_cta", 0.9, "interested"],
    ["objection_price", 0.9, "qualifying"],
    ["objection_time", 0.9, "qualifying"],
    ["objection_trust", 0.9, "qualifying"],
    ["follow_up", 0.95, "new"],
    ["do_not_send", 0.9, "not_a_fit"],
    ["do_not_send", 0.69, "new"],
    ["warm_intent", 0.49, "new"],
    ["booking_cta", undefined, "new"],
    ["unknown_class", 0.99, "new"],
  ])("%s @ %s → %s", (cls, conf, expected) => {
    expect(statusForIntent(cls, conf)).toBe(expected);
  });

  it("classifier error fallback (follow_up, 0) never promotes", () => {
    expect(statusForIntent("follow_up", 0)).toBe("new");
  });

  it("promotion threshold is inclusive", () => {
    expect(statusForIntent("warm_intent", STATUS_PROMOTION_THRESHOLD)).toBe("qualifying");
  });

  // intent-status.js keeps this as a literal to stay SDK-free; the comment
  // there says keep it in sync with the pause threshold. Enforce that.
  it("cold-label threshold matches the do_not_send pause threshold", () => {
    expect(DO_NOT_SEND_COLD_THRESHOLD).toBe(DO_NOT_SEND_PAUSE_THRESHOLD);
  });
});
