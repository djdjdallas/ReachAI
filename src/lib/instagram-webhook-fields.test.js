import { describe, it, expect } from "vitest";
import {
  REQUIRED_WEBHOOK_FIELDS,
  missingWebhookFields,
} from "./instagram-webhook-fields";

describe("REQUIRED_WEBHOOK_FIELDS", () => {
  it("never contains message_echoes", () => {
    // message_echoes is not a value in Meta's subscribed_apps enum. Echo
    // events arrive under the `messages` field with is_echo: true. As of
    // 2026-09-07 Meta rejects the ENTIRE subscribed_apps POST with a 400
    // when the list contains an unknown field — the rejection is atomic, so
    // including message_echoes left every new connect subscribed to NOTHING
    // (zero webhook events, zero conversations). Do not add it back.
    expect(REQUIRED_WEBHOOK_FIELDS).not.toContain("message_echoes");
  });

  it("is exactly the three fields a healthy install holds", () => {
    // Verified against a live healthy account via GET subscribed_apps on
    // 2026-09-07: ["messages", "messaging_postbacks", "comments"].
    expect(REQUIRED_WEBHOOK_FIELDS).toEqual([
      "messages",
      "messaging_postbacks",
      "comments",
    ]);
  });

  it("missingWebhookFields reports a fully subscribed account as healthy", () => {
    expect(missingWebhookFields(["messages", "messaging_postbacks", "comments"])).toEqual([]);
    expect(missingWebhookFields([])).toEqual(REQUIRED_WEBHOOK_FIELDS);
    expect(missingWebhookFields(null)).toEqual(REQUIRED_WEBHOOK_FIELDS);
  });
});
