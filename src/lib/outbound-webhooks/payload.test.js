import { describe, it, expect } from "vitest";
import { buildEnvelope, splitName } from "./payload";

const user = { id: "u1", business_name: "Solé Aesthetics", full_name: "Dom", instagram_username: "sole" };
const conversation = { id: "c1", origin: "clinchd_sent" };
const profile = { instagram_username: "jane.doe", email: "jane@example.com", phone: "+15125550123", treatment_interest: "botox" };
const ev = (type, extra = {}) => ({
  id: "123e4567-e89b-42d3-a456-426614174000",
  user_id: "u1",
  event_type: type,
  conversation_id: "c1",
  booking_id: null,
  data: {},
  occurred_at: "2026-10-06T10:00:00Z",
  ...extra,
});

describe("buildEnvelope", () => {
  it("builds the version 1 envelope", () => {
    const e = buildEnvelope({ event: ev("new_inquiry"), user, conversation, profile, booking: null });
    expect(e).toEqual({
      id: "evt_123e4567-e89b-42d3-a456-426614174000",
      type: "new_inquiry",
      version: "1",
      occurred_at: "2026-10-06T10:00:00.000Z",
      workspace: { id: "u1", name: "Solé Aesthetics" },
      lead: {
        id: "c1",
        instagram_username: "jane.doe",
        email: "jane@example.com",
        phone: "+15125550123",
        treatment_interest: "botox",
        source: "instagram_comment",
      },
      conversation: { id: "c1", trigger: null, trigger_type: "comment" },
      data: {},
    });
  });

  it("inbound DMs are source instagram_dm, trigger_type dm", () => {
    const e = buildEnvelope({ event: ev("dm_started"), user, conversation: { id: "c1", origin: "inbound" }, profile: null, booking: null });
    expect(e.lead).toEqual({ id: "c1", source: "instagram_dm" });
    expect(e.conversation).toEqual({ id: "c1", trigger: null, trigger_type: "dm" });
  });

  it("omits fields we don't have (omitted = unchanged)", () => {
    const e = buildEnvelope({ event: ev("follow_up_sent"), user, conversation, profile: { email: null }, booking: null });
    expect(Object.keys(e.lead)).toEqual(["id", "source"]);
  });

  it("drops invalid stored values instead of sending them", () => {
    const e = buildEnvelope({
      event: ev("contact_captured"),
      user,
      conversation,
      profile: { email: "not an email", phone: "555-0123", treatment_interest: "I want botox for my migraines", instagram_username: "bad name!" },
      booking: null,
    });
    expect(Object.keys(e.lead)).toEqual(["id", "source"]);
  });

  it("test events have no lead and no conversation", () => {
    const e = buildEnvelope({ event: ev("test", { conversation_id: null }), user, conversation: null, profile: null, booking: null });
    expect(e.lead).toBeNull();
    expect(e.conversation).toBeNull();
    expect(e.data).toEqual({});
  });

  it("handoff_requested carries only the reason", () => {
    const e = buildEnvelope({ event: ev("handoff_requested", { data: { reason: "medical_question", note: "pregnant" } }), user, conversation, profile, booking: null });
    expect(e.data).toEqual({ reason: "medical_question" });
    const odd = buildEnvelope({ event: ev("handoff_requested", { data: { reason: "whatever" } }), user, conversation, profile, booking: null });
    expect(odd.data).toEqual({ reason: "other" });
  });

  it("consultation_booked: scheduled_for, invitee names, demo only when flagged", () => {
    const booking = { id: "b1", start_time: "2026-10-08T17:00:00Z", invitee_name: "Jane Q Doe", invitee_email: "other@example.com", conversation_id: "c1" };
    const e = buildEnvelope({ event: ev("consultation_booked", { booking_id: "b1" }), user, conversation, profile: { instagram_username: "jane.doe" }, booking });
    expect(e.data).toEqual({ scheduled_for: "2026-10-08T17:00:00.000Z" });
    expect(e.lead).toMatchObject({ id: "c1", first_name: "Jane", last_name: "Q Doe" });
    // Matched (possibly by name): the invitee's email is not attached.
    expect(e.lead.email).toBeUndefined();
    const demo = buildEnvelope({ event: ev("consultation_booked", { booking_id: "b1", data: { demo: true } }), user, conversation, profile, booking });
    expect(demo.data).toEqual({ scheduled_for: "2026-10-08T17:00:00.000Z", demo: true });
  });

  it("an unmatched booking is a booking-only lead with the invitee's email", () => {
    const booking = { id: "b9", start_time: null, invitee_name: "Jane", invitee_email: "Jane@Example.com", conversation_id: null };
    const e = buildEnvelope({ event: ev("consultation_booked", { conversation_id: null, booking_id: "b9" }), user, conversation: null, profile: null, booking });
    expect(e.lead).toEqual({ id: "bkg_b9", first_name: "Jane", email: "jane@example.com" });
    expect(e.conversation).toBeNull();
    expect(e.data).toEqual({ scheduled_for: null });
  });

  it("never contains message text or medical details from any input", () => {
    const e = buildEnvelope({
      event: ev("handoff_requested", { data: { reason: "medical_question", message: "I'm pregnant, is botox safe?" } }),
      user: { ...user, ai_summary: "pregnant lead" },
      conversation: { ...conversation, ai_summary: "pregnant", sender_name: "x" },
      profile: { ...profile, notes: "pregnant" },
      booking: null,
    });
    expect(JSON.stringify(e)).not.toMatch(/pregnant|safe\?/i);
  });

  it("workspace name falls back to full name, then handle", () => {
    expect(buildEnvelope({ event: ev("test"), user: { id: "u1", full_name: "Dom" } }).workspace.name).toBe("Dom");
    expect(buildEnvelope({ event: ev("test"), user: { id: "u1", instagram_username: "sole" } }).workspace.name).toBe("@sole");
  });
});

describe("splitName", () => {
  it("splits on the first space and rejects junk", () => {
    expect(splitName("Jane Doe")).toEqual({ first: "Jane", last: "Doe" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: null });
    expect(splitName("  ")).toEqual({ first: null, last: null });
    expect(splitName("<script> x")).toEqual({ first: null, last: "x" });
  });
});
