import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-utils";
import { sendInstagramMessage } from "@/lib/instagram";
import { markDripStatus } from "@/lib/drip/queue";
import { buildSystemPrompt } from "@/lib/prompts";
import { generateReply } from "@/lib/anthropic";

// The core engine. Re-verifies ALL 8 conditions at FIRE time (state changes
// constantly between schedule and fire) and only then sends. Every skip path
// records a specific skip_reason so the queue is auditable. The cron route
// calls processDrip once per claimed ('processing') row.
//
// Meta-policy guardrails enforced here:
//   - Condition 1/2: master toggle + ai_mode + plan re-checked (deploy-dark,
//     global AI off, downgrade)
//   - Condition 5: 23h safety buffer — never send within 60 min of the
//     24-hour window closing, even if drip_delay_hours allowed scheduling at
//     the max of 22h.

// Appended to the standard system prompt when no coach-authored template is
// active for this intent class. The nudge is composed through the same reply
// pipeline the webhook uses, so it lands in the account's voice.
const DRIP_NUDGE_MODE = `

---

FOLLOW-UP NUDGE MODE (this generation only):
The lead has gone quiet since your last message. Write ONE short, warm, low-pressure check-in that picks the thread back up naturally — reference what you were talking about.
- 1-2 sentences maximum.
- Never guilt the lead and never manufacture urgency. No pressure tactics, no "did you see my message", no countdown language.
- Do not repeat your last message word-for-word and do not re-ask an ignored question the same way; come at it lightly from a fresh angle or simply leave the door open.
- Output only the message text.`;

/**
 * Process a single claimed drip row.
 * @param {object} dripRow - a row from dm_drip_queue with status='processing'
 */
export async function processDrip(dripRow) {
  const admin = getSupabaseAdmin();

  // CONDITION 1: User still has drip_enabled = true (master kill switch) AND
  // ai_mode = 'active'. A coach who flipped the global AI to off/handoff after
  // this row was scheduled expects total silence — a nudge firing anyway would
  // break that promise.
  const { data: user } = await admin
    .from("users")
    .select(
      "id, email, plan, subscription_status, drip_enabled, ai_mode, script_config, voice_profile, calendly_url, meta_page_access_token, instagram_business_account_id"
    )
    .eq("id", dripRow.user_id)
    .single();

  if (!user || user.drip_enabled !== true) {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "user_drip_disabled" });
  }
  if (user.ai_mode !== "active") {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "ai_mode_not_active" });
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
    .select("id, ai_paused, status, last_message_at, origin, missing_outbound_context")
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
    .select("id, role, content, source, created_at, intent_classification")
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
  if (["manual", "native_send"].includes(mostRecent.source)) {
    // The coach hand-typed the latest message (echo-captured as assistant).
    // A human is actively working this thread — never stack a nudge on top.
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "manual_reply_since_schedule",
    });
  }

  const lastLeadMessage = recentMessages.find((m) => m.role === "user");
  if (!lastLeadMessage) {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "no_lead_messages_found",
    });
  }

  // CONDITION 5: 24-hour window check (CRITICAL). Refuse within 60 min of
  // expiry so we never send outside Instagram's messaging window — the margin
  // absorbs cron lag, generation latency, and clock skew.
  const hoursElapsed =
    (Date.now() - new Date(lastLeadMessage.created_at).getTime()) / (1000 * 60 * 60);
  // Negated form so an unparseable timestamp (NaN) fails CLOSED — only a
  // provably-open window may proceed past this line.
  if (!(hoursElapsed < 23)) {
    return markDripStatus(dripRow.id, "expired", { skipReason: "window_closing" });
  }

  // CONDITION 6: do_not_send on the lead's last classified message → hard skip.
  const lastIntent = lastLeadMessage.intent_classification;
  if (lastIntent?.class === "do_not_send") {
    return markDripStatus(dripRow.id, "skipped", {
      skipReason: "lead_marked_do_not_send",
    });
  }

  // CONDITION 7: Resolve the nudge content. A coach-authored active template
  // wins. When none exists (or it was deactivated/deleted since enqueue), the
  // nudge is composed through the existing reply pipeline instead of skipping,
  // so the feature works before the coach has authored any templates.
  let template = null;
  if (dripRow.template_id) {
    const { data } = await admin
      .from("dm_drip_templates")
      .select("id, content, intent_class, is_active")
      .eq("id", dripRow.template_id)
      .single();
    if (data?.is_active) template = data;
  }

  // CONDITION 8: User has a valid IG connection.
  if (!user.meta_page_access_token || !user.instagram_business_account_id) {
    return markDripStatus(dripRow.id, "skipped", { skipReason: "ig_not_connected" });
  }

  // Compose the fallback nudge only after every gate has passed, so we never
  // pay generation latency for a row that was going to be skipped anyway.
  let nudgeText = template?.content || null;
  const contentSource = template ? "template" : "generated";
  if (!nudgeText) {
    try {
      const systemPrompt =
        buildSystemPrompt(user.script_config || {}, user.calendly_url, {
          voiceProfile: user.voice_profile,
          conversation: conv,
        }) + DRIP_NUDGE_MODE;
      // `source` must survive this map. It is already selected above, and
      // generateReply uses it to label who actually typed each message —
      // role='assistant' covers both the AI's replies and ones the coach typed
      // by hand. Dropping it here would let the nudge misread the coach's own
      // words as the lead's, the same defect fixed in the reply path.
      const history = [...recentMessages]
        .reverse()
        .map((m) => ({ role: m.role, content: m.content || "", source: m.source }));
      // The trailing cue keeps the API call from reading as a continuation of
      // our own last message. It is never persisted or shown to anyone.
      history.push({
        role: "user",
        content:
          "[Internal note, not from the lead: they have gone quiet since your last message. Write your single follow-up nudge now, per FOLLOW-UP NUDGE MODE.]",
      });
      nudgeText = (await generateReply(systemPrompt, history))?.trim();
    } catch (err) {
      console.error("[drip/processor] nudge compose failed:", err?.message);
    }
    // A 900+ char "1-2 sentence nudge" is a failed generation, and truncating
    // could sever a booking link mid-URL — skip rather than send a mangled DM.
    if (!nudgeText || nudgeText.length > 900) {
      return markDripStatus(dripRow.id, "skipped", {
        skipReason: "nudge_compose_failed",
      });
    }
  }

  // ── ALL 8 CONDITIONS PASSED — send the nudge ──────────────────────────
  try {
    // Mark fired BEFORE sending, guarded on 'processing'. A run killed
    // between send and a later fired-update used to leave the row for the
    // 30-min reclaim, which re-sent the same nudge. Zero rows updated means
    // the reclaim already handed this row to another run — do not send.
    // Failing the safe way (marked fired, send below errors) reverts to
    // 'skipped' in the catch.
    const { data: fireMark, error: fireMarkErr } = await admin
      .from("dm_drip_queue")
      .update({ status: "fired", fired_at: new Date().toISOString() })
      .eq("id", dripRow.id)
      .eq("status", "processing")
      .select("id");
    if (fireMarkErr || !fireMark?.length) {
      return { status: "skipped", reason: "lost_claim" };
    }

    // Reserve the Meta 200/hr outbound slot BEFORE sending (webhook paths
    // reserve-first; recording after the send could push a user over cap).
    const { data: outboundAllowed, error: outboundErr } = await admin.rpc(
      "check_and_record_outbound",
      { uid: user.id }
    );
    if (outboundErr) {
      console.warn("[drip/processor] outbound rate RPC failed:", outboundErr.message);
    } else if (outboundAllowed === false) {
      return markDripStatus(dripRow.id, "skipped", {
        skipReason: "rate_limited",
      });
    }

    // Save the visible row BEFORE sending so the echo webhook's twin-match
    // finds it — a sub-second echo arriving before this insert used to be
    // captured as a human takeover and permanently pause the AI on its own
    // nudge. source='drip' distinguishes it from a regular AI reply.
    const { data: nudgeRow } = await admin
      .from("messages")
      .insert({
        conversation_id: dripRow.conversation_id,
        role: "assistant",
        content: nudgeText,
        source: "drip",
      })
      .select("id")
      .single();

    const decryptedToken = decryptToken(user.meta_page_access_token);
    try {
      await sendInstagramMessage(
        user.instagram_business_account_id,
        dripRow.recipient_psid,
        nudgeText,
        decryptedToken
      );
    } catch (sendErr) {
      // Undo the optimistic row so the inbox doesn't show an unsent nudge.
      if (nudgeRow?.id) {
        await admin.from("messages").delete().eq("id", nudgeRow.id);
      }
      throw sendErr;
    }

    await admin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", dripRow.conversation_id);

    // Increment the template's send_count (composed nudges have no template).
    if (template) {
      await admin.rpc("increment_drip_send_count", { template_id: template.id });
    }

    const { getPostHogClient } = await import("@/lib/posthog-server");
    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "drip_fired",
      properties: {
        conversation_id: dripRow.conversation_id,
        intent_class: dripRow.intent_class,
        template_id: template?.id || null,
        content_source: contentSource,
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
