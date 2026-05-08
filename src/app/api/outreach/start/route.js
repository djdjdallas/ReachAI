import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  sendInstagramMessage,
  resolveUsernameToIgsid,
  getParticipantProfile,
} from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { getPostHogClient } from "@/lib/posthog-server";
import { enforceAiRateLimit } from "@/lib/rate-limit";

// IGSIDs are numeric strings, typically 15-20 digits. Used as a fallback
// when username resolution fails so the founder can paste an ID directly.
const IGSID_PATTERN = /^\d{15,20}$/;

export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const rl = await enforceAiRateLimit(admin, user.id, "outreach_start", 60);
    if (rl) return rl;

    const { username, message } = await request.json();
    const trimmedUsername = String(username || "").trim();
    const trimmedMessage = String(message || "").trim();

    if (!trimmedUsername || !trimmedMessage) {
      return NextResponse.json(
        { error: "username and message are required" },
        { status: 400 }
      );
    }

    const { data: userProfile, error: profileError } = await admin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    if (!userProfile.instagram_business_account_id || !userProfile.meta_page_access_token) {
      return NextResponse.json(
        { error: "Instagram account not connected" },
        { status: 400 }
      );
    }

    const pageAccessToken = decryptToken(userProfile.meta_page_access_token);
    const cleanUsername = trimmedUsername.replace(/^@/, "");

    let igsid = null;
    let resolvedUsername = cleanUsername;
    let resolvedName = null;
    let resolvedVia = null;

    if (IGSID_PATTERN.test(cleanUsername)) {
      // Founder pasted a raw IGSID. Try to enrich the display name via the
      // profile endpoint, but proceed even if that fails — the IGSID alone
      // is enough to send.
      igsid = cleanUsername;
      resolvedVia = "igsid";
      const profile = await getParticipantProfile(igsid, pageAccessToken);
      if (profile) {
        resolvedUsername = profile.username || cleanUsername;
        resolvedName = profile.name || null;
      }
    } else {
      const resolved = await resolveUsernameToIgsid(
        userProfile.instagram_business_account_id,
        cleanUsername,
        pageAccessToken
      );
      if (!resolved) {
        return NextResponse.json(
          {
            error:
              "Username not resolvable — Business Discovery only works for public business or creator accounts. Paste the recipient's IGSID instead.",
          },
          { status: 400 }
        );
      }
      igsid = resolved.igsid;
      resolvedUsername = resolved.username;
      resolvedName = resolved.name;
      resolvedVia = "username";
    }

    // Find-or-create the conversation row keyed on (user_id, igsid).
    let { data: conversation } = await admin
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("instagram_sender_id", igsid)
      .maybeSingle();

    if (conversation) {
      // Refuse to convert an existing inbound-initiated thread into outreach —
      // that would let the composer reset the gate on a personal DM thread.
      const { data: earliest } = await admin
        .from("messages")
        .select("source")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (earliest && earliest.source === "lead") {
        return NextResponse.json(
          {
            error:
              "This conversation was started by the recipient — agent stays in handoff mode. Reply manually from the thread instead.",
            reason: "already_inbound_initiated",
          },
          { status: 409 }
        );
      }
    } else {
      const { data: newConv, error: createError } = await admin
        .from("conversations")
        .insert({
          user_id: user.id,
          instagram_sender_id: igsid,
          instagram_thread_id: igsid,
          status: "qualifying",
          ai_paused: false,
          sender_name: resolvedName || resolvedUsername,
        })
        .select()
        .single();
      if (createError || !newConv) {
        return NextResponse.json(
          { error: "Failed to create conversation" },
          { status: 500 }
        );
      }
      conversation = newConv;
    }

    // Insert the manual outreach row BEFORE attempting delivery, so the
    // gate-passing marker exists even if Meta rejects the send (24-hour
    // window, blocked recipient, etc.). Founder can retry from the thread.
    const { data: savedMessage, error: saveError } = await admin
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        role: "assistant",
        content: trimmedMessage,
        source: "manual",
      })
      .select()
      .single();

    if (saveError) {
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    await admin
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_skip_reason: null,
      })
      .eq("id", conversation.id);

    let deliveryOk = true;
    let deliveryError = null;
    try {
      await sendInstagramMessage(
        userProfile.instagram_business_account_id,
        igsid,
        trimmedMessage,
        pageAccessToken
      );
    } catch (err) {
      deliveryOk = false;
      deliveryError = err?.message || "send failed";
    }

    getPostHogClient().capture({
      distinctId: user.email || user.id,
      event: "outreach_started",
      properties: {
        conversation_id: conversation.id,
        resolved_via: resolvedVia,
        delivery_ok: deliveryOk,
      },
    });

    if (!deliveryOk) {
      return NextResponse.json(
        {
          conversationId: conversation.id,
          message: savedMessage,
          delivery_ok: false,
          error: `Saved to dashboard but Instagram rejected delivery: ${deliveryError}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { conversationId: conversation.id, message: savedMessage, delivery_ok: true },
      { status: 200 }
    );
  } catch (error) {
    console.error("Outreach start error:", error);
    getPostHogClient().capture({
      distinctId: "unknown",
      event: "outreach_start_failed",
      properties: { endpoint: "/api/outreach/start", error: error.message },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
