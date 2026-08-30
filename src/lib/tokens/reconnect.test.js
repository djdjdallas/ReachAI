import { describe, it, expect } from "vitest";
import { isMetaAuthError, isMetaTokenRevoked } from "./reconnect";
import { metaApiError } from "@/lib/instagram";

// Shapes as Meta returns them in `data.error`, wrapped the way the Graph
// helpers wrap them before they reach the webhook's catch blocks.
const graph = (error) => metaApiError("Failed to send Instagram message", error);

const SESSION_INVALIDATED_MSG =
  "Error validating access token: The session has been invalidated because the user changed their password or Facebook has changed the session for security reasons.";

describe("isMetaTokenRevoked (strict runtime predicate)", () => {
  const cases = [
    // genuinely dead tokens → flag
    [{ type: "OAuthException", code: 190, error_subcode: 458, message: "x" }, true, "190/458 app removed"],
    [{ type: "OAuthException", code: 190, error_subcode: 460, message: "x" }, true, "190/460 password changed"],
    [{ type: "OAuthException", code: 190, error_subcode: 463, message: "x" }, true, "190/463 expired"],
    [{ type: "OAuthException", code: 190, error_subcode: 467, message: "x" }, true, "190/467 invalid"],
    [{ type: "OAuthException", code: 190, error_subcode: 0, message: SESSION_INVALIDATED_MSG }, true, "190/subcode 0 + dead-session message (observed 2026-08-27)"],
    [{ type: "OAuthException", code: 190, message: "The user has not authorized application 123." }, true, "190/no subcode + app-removed message (observed 2026-08-23)"],
    // OAuthException but NOT a dead token → must not flag
    [{ type: "OAuthException", code: 551, message: "(#551) This person isn't available right now." }, false, "551 lead unavailable (the reported defect)"],
    [{ type: "OAuthException", code: 10, message: "(#10) This message is sent outside of allowed window." }, false, "10 outside allowed window"],
    [{ type: "OAuthException", code: 4, message: "(#4) Application request limit reached" }, false, "4 rate limit"],
    [{ type: "OAuthException", code: 17, message: "(#17) User request limit reached" }, false, "17 rate limit"],
    [{ type: "OAuthException", code: 32, message: "(#32) Page request limit reached" }, false, "32 rate limit"],
    [{ type: "OAuthException", code: 613, message: "(#613) Calls to this api have exceeded the rate limit." }, false, "613 rate limit"],
    [{ type: "OAuthException", code: 100, message: "(#100) Invalid parameter" }, false, "100 invalid parameter"],
    [{ type: "OAuthException", code: 200, message: "(#200) Permissions error" }, false, "200 permissions"],
    // 190 with an unrelated subcode and a non-matching message → not flagged
    [{ type: "OAuthException", code: 190, error_subcode: 999, message: "something else" }, false, "190 with unknown subcode"],
    [{ type: "OAuthException", code: 190, error_subcode: 0, message: "something else" }, false, "190 subcode 0 with unrelated message"],
  ];

  it.each(cases)("%o -> %s (%s)", (payload, expected) => {
    expect(isMetaTokenRevoked(graph(payload))).toBe(expected);
    // also accepts the raw Graph payload shape
    expect(isMetaTokenRevoked(payload)).toBe(expected);
  });

  it("returns false for errors with no Meta shape", () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(isMetaTokenRevoked(timeout)).toBe(false);
    expect(isMetaTokenRevoked(new Error("fetch failed"))).toBe(false);
    expect(isMetaTokenRevoked(undefined)).toBe(false);
    expect(isMetaTokenRevoked(null)).toBe(false);
    expect(isMetaTokenRevoked({})).toBe(false);
    expect(isMetaTokenRevoked(graph(undefined))).toBe(false);
    expect(isMetaTokenRevoked(graph({}))).toBe(false);
  });

  it("does not trip on a dead-session message alone without code 190", () => {
    expect(isMetaTokenRevoked(new Error(SESSION_INVALIDATED_MSG))).toBe(false);
    expect(isMetaTokenRevoked(graph({ code: 100, message: "Invalid OAuth access token" }))).toBe(false);
  });
});

describe("isMetaAuthError (cron predicate) is intentionally broader", () => {
  // On refresh_access_token any OAuthException is a dead token, so the cron
  // keeps its wide match. These cases pin the two predicates apart so nobody
  // later folds them back into one.
  it("flags OAuthException regardless of code, unlike the runtime rule", () => {
    const rateLimit = graph({ type: "OAuthException", code: 4, message: "(#4) Application request limit reached" });
    expect(isMetaAuthError(rateLimit)).toBe(true);
    expect(isMetaTokenRevoked(rateLimit)).toBe(false);

    const unavailable = graph({ type: "OAuthException", code: 551, message: "(#551) This person isn't available right now." });
    expect(isMetaAuthError(unavailable)).toBe(true);
    expect(isMetaTokenRevoked(unavailable)).toBe(false);
  });

  it("both agree on a genuinely dead token", () => {
    const dead = graph({ type: "OAuthException", code: 190, error_subcode: 460, message: SESSION_INVALIDATED_MSG });
    expect(isMetaAuthError(dead)).toBe(true);
    expect(isMetaTokenRevoked(dead)).toBe(true);
  });

  it("cron message fallback still matches with no structured fields", () => {
    expect(isMetaAuthError(new Error("Instagram token refresh failed: Session has expired"))).toBe(true);
  });
});
