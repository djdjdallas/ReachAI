import { describe, it, expect } from "vitest";
import { matchBookingConversation } from "./calendly-match";
import { fakeDb } from "@/lib/test-utils/fake-db";

const db = () =>
  fakeDb({
    lead_profiles: [
      { conversation_id: "c-email", user_id: "u1", email: "jane@example.com" },
      { conversation_id: "c-other-user", user_id: "u2", email: "sam@example.com" },
    ],
    conversations: [
      { id: "c-jane", user_id: "u1", sender_name: "Jane Doe" },
      { id: "c-ann1", user_id: "u1", sender_name: "Ann Lee" },
      { id: "c-ann2", user_id: "u1", sender_name: "Ann Lee Smith" },
      { id: "c-pct", user_id: "u1", sender_name: "100% Real" },
    ],
  });

describe("matchBookingConversation", () => {
  it("matches the lead's captured email first (case-insensitive)", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: "JANE@example.com", inviteeName: "Ann Lee" })).toBe("c-email");
  });

  it("only within the same account", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: "sam@example.com", inviteeName: "" })).toBeNull();
  });

  it("falls back to a unique name match", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: "nobody@example.com", inviteeName: "Jane Doe" })).toBe("c-jane");
  });

  it("two or more name matches is no match (booking-only lead)", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "Ann Lee" })).toBeNull();
  });

  it("escapes LIKE wildcards in the invitee name", async () => {
    // Unescaped, "%" would match all four conversations (ambiguous, null).
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "%" })).toBe("c-pct");
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "_" })).toBeNull();
  });

  it("no name and no email: no match", async () => {
    expect(await matchBookingConversation(db(), "u1", {})).toBeNull();
  });
});
