// Links a Calendly booking to the lead's conversation
// (src/app/api/webhooks/calendly/route.js).

/**
 * Which conversation a Calendly booking belongs to, or null.
 *   1. A lead profile with the invitee's email (captured from the DMs).
 *   2. Otherwise the conversation whose sender_name is exactly the invitee's
 *      full name (case-insensitive, whitespace collapsed), and only when
 *      exactly one conversation has it. "Ann" never matches "Joanne"; two
 *      or more matches are ambiguous. A wrong match would mark the wrong
 *      lead booked and report the booking against the wrong lead.
 * With no match the booking is stored without a conversation; its webhook
 * event reports a booking-only lead.
 *
 * @returns {Promise<string|null>}
 */
export async function matchBookingConversation(supabase, userId, { inviteeEmail, inviteeName }) {
  const email = typeof inviteeEmail === "string" ? inviteeEmail.trim().toLowerCase() : "";
  if (email) {
    const { data: byEmail, error } = await supabase
      .from("lead_profiles")
      .select("conversation_id")
      .eq("user_id", userId)
      .eq("email", email)
      .limit(2);
    if (!error && byEmail?.length === 1) return byEmail[0].conversation_id;
  }
  const name = normalizeName(inviteeName);
  // PostgREST also reads * as a wildcard in like patterns; a name carrying
  // one can't be matched exactly, so it matches nothing.
  if (!name || name.includes("*")) return null;
  const { data: byName, error } = await supabase
    .from("conversations")
    .select("id, sender_name")
    .eq("user_id", userId)
    // No wildcards: an exact, case-insensitive comparison. % _ \ escaped.
    .ilike("sender_name", name.replace(/[\\%_]/g, (c) => `\\${c}`))
    .limit(2);
  if (error) return null;
  const exact = (byName || []).filter((c) => normalizeName(c.sender_name).toLowerCase() === name.toLowerCase());
  return exact.length === 1 && (byName || []).length === 1 ? exact[0].id : null;
}

/** Trim and collapse internal whitespace. */
export function normalizeName(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}
