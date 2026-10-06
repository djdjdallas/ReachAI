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
      { id: "c-joanne", user_id: "u1", sender_name: "Joanne" },
      { id: "c-ann1", user_id: "u1", sender_name: "Ann Lee" },
      { id: "c-ann2", user_id: "u1", sender_name: "ann lee" },
      { id: "c-pct", user_id: "u1", sender_name: "100% Real" },
      { id: "c-star", user_id: "u1", sender_name: "Star*" },
    ],
  });

describe("matchBookingConversation", () => {
  it("matches the lead's captured email first (case-insensitive)", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: "JANE@example.com", inviteeName: "Ann Lee" })).toBe("c-email");
  });

  it("only within the same account", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: "sam@example.com", inviteeName: "" })).toBeNull();
  });

  it("falls back to an exact, case-insensitive full-name match", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: "nobody@example.com", inviteeName: "jane  DOE " })).toBe("c-jane");
  });

  it("a partial name never matches (audit: Ann vs Joanne)", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "Ann" })).toBeNull();
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "Jane" })).toBeNull();
  });

  it("two or more exact matches is no match (booking-only lead)", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "Ann Lee" })).toBeNull();
  });

  it("wildcards are literal: % and _ match only themselves, * matches nothing", async () => {
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "%" })).toBeNull();
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "100% Real" })).toBe("c-pct");
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "_" })).toBeNull();
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "*" })).toBeNull();
    expect(await matchBookingConversation(db(), "u1", { inviteeEmail: null, inviteeName: "Star*" })).toBeNull();
  });

  it("no name and no email: no match", async () => {
    expect(await matchBookingConversation(db(), "u1", {})).toBeNull();
  });
});
