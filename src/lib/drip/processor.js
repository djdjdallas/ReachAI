import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-utils";
import { sendInstagramMessage } from "@/lib/instagram";
import { markDripStatus } from "@/lib/drip/queue";

// The core engine. Re-verifies ALL 8 conditions at FIRE time (state changes
// constantly between schedule and fire) and only then sends. Every skip path
// records a specific skip_reason so the queue is auditable. The cron route
// calls processDrip once per claimed ('processing') row.
//
// Meta-policy guardrails enforced here:
//   - Condition 1/2: master toggle + plan re-checked (deploy-dark + downgrade)
//   - Condition 5: 23.5h safety buffer — never send within 30 min of the
//     24-hour window closing, even if drip_delay_hours allowed scheduling at
//     the max of 22h.

/**
 * Process a single claimed drip row.
 * @param {object} dripRow - a row from dm_drip_queue with status='processing'
 */
export async function processDrip(dripRow) {
  const admin = getSupabaseAdmin();

  // CONDITION 1: User still has drip_enabled = true (master kill switch).
  const { data: user } = await admin
    .from("users")
    .select(
      "id, email, plan, subscription_status, drip_enabled, meta_page_access_token, instagram_business_account_id"
    )
    .eq("id", dripRow.user_id)
    .single();

  if (!user || user.drip_enabled !== true) {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "user_drip_disabled" });
  }

  // CONDITION 2: User still on Unlimited and active/trialing (downgrade path).
  if (
    user.plan !== "unlimited" ||
    !["active", "trialing"].includes(user.subscription_status)
  ) {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "plan_no_longer_eligible",
    });
  }

  // CONDITION 3: Conversation must exist, not be paused, not be terminal.
  const { data: conv } = await admin
    .from("conversations")
    .select("id, ai_paused, status, last_message_at")
    .eq("id", dripRow.conversation_id)
    .single();

  if (!conv) {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "conversation_not_found",
    });
  }
  if (conv.ai_paused === true) {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "conversation_paused" });
  }
  if (!["qualifying", "interested"].includes(conv.status)) {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "conversation_status_ineligible",
    });
  }

  // CONDITION 4: Most recent message must be from the AI (lead hasn't replied
  // since we scheduled), and a lead message must exist.
  const { data: recentMessages } = await admin
    .from("messages")
    .select("id, role, source, created_at, intent_classification")
    .eq("conversation_id", dripRow.conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!recentMessages || recentMessages.length === 0) {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "no_messages" });
  }

  const mostRecent = recentMessages[0];
  if (mostRecent.role === "user") {
    // Lead replied since we scheduled. Insertion D should have canceled this;
    // defense in depth.
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "lead_replied_since_schedule",
    });
  }

  const lastLeadMessage = recentMessages.find((m) => m.role === "user");
  if (!lastLeadMessage) {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "no_lead_messages_found",
    });
  }

  // CONDITION 5: 24-hour window check (CRITICAL). Refuse within 30 min of
  // expiry so we never send outside Instagram's messaging window.
  const hoursElapsed =
    (Date.now() - new Date(lastLeadMessage.created_at).getTime()) / (1000 * 60 * 60);
  if (hoursElapsed >= 23.5) {
    return markDripStatus(dripRow.id, "expired", { skipReason: "window_closing" });
  }

  // CONDITION 6: do_not_send on the lead's last classified message → hard skip.
  const lastIntent = lastLeadMessage.intent_classification;
  if (lastIntent?.class === "do_not_send") {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "lead_marked_do_not_send",
    });
  }

  // CONDITION 7: Template still exists and is active.
  const { data: template } = await admin
    .from("dm_drip_templates")
    .select("id, content, intent_class, is_active")
    .eq("id", dripRow.template_id)
    .single();

  if (!template || !template.is_active) {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "template_missing_or_inactive",
    });
  }

  // CONDITION 8: User has a valid IG connection.
  if (!user.meta_page_access_token || !user.instagram_business_account_id) {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "ig_not_connected" });
  }

  // ── ALL 8 CONDITIONS PASSED — send the nudge ──────────────────────────
  try {
    const decryptedToken = decryptToken(user.meta_page_access_token);
    await sendInstagramMessage(
      user.instagram_business_account_id,
      dripRow.recipient_psid,
      template.content,
      decryptedToken
    );

    // Save a visible row so the inbox shows the nudge. source='drip'
    // distinguishes it from a regular AI reply ('agent').
    await admin.from("messages").insert({
      conversation_id: dripRow.conversation_id,
      role: "assistant",
      content: template.content,
      source: "drip",
    });

    await admin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", dripRow.conversation_id);

    // Count toward Meta's 200/hr outbound DM cap.
    await admin.rpc("check_and_record_outbound", { uid: user.id });

    // Increment the template's send_count.
    await admin.rpc("increment_drip_send_count", { template_id: template.id });

    // Mark fired.
    await admin
      .from("dm_drip_queue")
      .update({ status: "fired", fired_at: new Date().toISOString() })
      .eq("id", dripRow.id);

    const { getPostHogClient } = await import("@/lib/posthog-server");
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "drip_fired",
      properties: {
        conversation_id: dripRow.conversation_id,
        intent_class: dripRow.intent_class,
        template_id: template.id,
        hours_elapsed: hoursElapsed,
      },
    });

    return { status: "fired" };
  } catch (err) {
    await markDripStatus(dripRow.id, "skipped", {
      skipReason: "ig_send_failed",
      errorMessage: err?.message || "unknown",
    });
    return { status: "error", error: err };
  }
}
