// Links a Calendly booking to the lead's conversation
// (src/app/api/webhooks/calendly/route.js).

/**
 * Which conversation a Calendly booking belongs to, or null.
 *   1. A lead profile with the invitee's email (captured from the DMs).
 *   2. Otherwise the fuzzy name match on sender_name, but only when exactly
 *      one conversation matches: two or more is ambiguous, and a wrong match
 *      would mark the wrong lead booked (and, with outbound webhooks, report
 *      the booking against the wrong lead).
 * With no match the booking is stored without a conversation; its webhook
 * event reports a booking-only lead.
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
  const name = typeof inviteeName === "string" ? inviteeName.trim() : "";
  if (!name) return null;
  const { data: byName, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", userId)
    .ilike("sender_name", `%${name.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
    .limit(2);
  if (error || byName?.length !== 1) return null;
  return byName[0].id;
}
