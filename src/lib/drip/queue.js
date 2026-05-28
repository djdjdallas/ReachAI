import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTemplate } from "@/lib/drip/templates";

// Drip queue lifecycle. All writes are service-role (RLS on dm_drip_queue
// grants SELECT only to the owner). The "one drip per conversation" invariant
// is enforced at the DB layer by the partial unique index
// drip_queue_one_active_per_conversation; enqueueDrip catches the conflict
// and returns null rather than throwing.

/**
 * Schedules a follow-up nudge for a conversation. Captures the active template
 * id at enqueue time (the template may be edited/deactivated before the nudge
 * fires; the processor re-checks the template anyway).
 *
 * Returns the inserted row, or null when:
 *   - an active drip already exists for this conversation (unique conflict), or
 *   - the insert otherwise fails.
 * Never throws — the webhook caller treats enqueue as best-effort.
 *
 * @returns {Promise<object|null>}
 */
export async function enqueueDrip({
  userId,
  conversationId,
  recipientPsid,
  intentClass,
  delayHours,
}) {
  const supabase = getSupabaseAdmin();

  const hours = Number(delayHours) || 18;
  const scheduledAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  // Capture the template at enqueue time. A null template_id is allowed — the
  // processor will skip with 'template_missing_or_inactive' if it's still null
  // (or deactivated) at fire time, so we never send an empty nudge.
  let templateId = null;
  try {
    const template = await getActiveTemplate(userId, intentClass);
    templateId = template?.id || null;
  } catch (err) {
    console.warn("[drip/queue] template lookup at enqueue failed:", err?.message);
  }

  const { data, error } = await supabase
    .from("dm_drip_queue")
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      recipient_psid: recipientPsid,
      intent_class: intentClass,
      template_id: templateId,
      scheduled_at: scheduledAt,
      status: "scheduled",
    })
    .select()
    .single();

  if (error) {
    const isUniqueConflict =
      error.code === "23505" ||
      (typeof error.message === "string" &&
        error.message.includes("drip_queue_one_active_per_conversation"));
    if (isUniqueConflict) {
      // Expected when a drip is already scheduled/processing for this
      // conversation. The "one nudge per conversation" guarantee held.
      console.warn(
        "[drip/queue] enqueue skipped — active drip already exists for conversation:",
        conversationId
      );
      return null;
    }
    console.error("[drip/queue] enqueueDrip insert failed:", error.message);
    return null;
  }

  return data;
}

/**
 * Cancels any SCHEDULED drip for a conversation. Rows already claimed by the
 * cron ('processing') are intentionally NOT canceled — they're mid-flight and
 * the processor re-verifies all 8 conditions before sending, so letting them
 * finish is safe.
 *
 * @returns {Promise<number>} count of rows canceled
 */
export async function cancelDripForConversation(conversationId, reason) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dm_drip_queue")
    .update({ status: "canceled", skip_reason: reason })
    .eq("conversation_id", conversationId)
    .eq("status", "scheduled")
    .select("id");

  if (error) {
    console.error("[drip/queue] cancelDripForConversation failed:", error.message);
    return 0;
  }
  return data?.length || 0;
}

/**
 * Sets a terminal/intermediate status on a single drip row. Used by the
 * processor's skip/error paths. fired_at is set separately by the success
 * path in the processor.
 */
export async function markDripStatus(dripId, status, { skipReason, errorMessage } = {}) {
  const supabase = getSupabaseAdmin();
  const patch = { status };
  if (skipReason !== undefined) patch.skip_reason = skipReason;
  if (errorMessage !== undefined) patch.error_message = errorMessage;

  const { error } = await supabase
    .from("dm_drip_queue")
    .update(patch)
    .eq("id", dripId);

  if (error) {
    console.error("[drip/queue] markDripStatus failed:", error.message);
  }
  return { status };
}

/**
 * Lists drip rows for a user, newest scheduled first. For the future drip
 * analytics view.
 */
export async function listDripsForUser(userId, { limit = 50, status } = {}) {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("dm_drip_queue")
    .select("*")
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    throw new Error(`listDripsForUser failed: ${error.message}`);
  }
  return data || [];
}
