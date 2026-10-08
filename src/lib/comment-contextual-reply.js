// The AI-written comment reply for managed accounts: a lead with no
// thread yet (the first DM), or one whose thread went quiet
// (src/lib/comment-open-thread.js). Instead of the generic template, the
// normal AI reply path writes the reply: the same
// system prompt (script, voice, persona and identity rules, active offer,
// business knowledge, booking link, never claiming availability), the
// thread's history (none for a first DM), and the comment as the lead's
// newest turn:
//   They commented on your post (caption: "..."): "<comment>"
// The output goes through lintReply like every reply path. A handoff
// marker (a medical question, or a price/availability/policy question the
// knowledge doesn't cover) returns the account's holding text instead.
//
// The comment itself is not saved to the thread, like the template opener
// it replaces: a role 'user' row would read as an inbound DM and reopen
// the 24h window the drip processor and the dashboard reply measure.
//
// Never throws.

import { buildSystemPrompt } from "@/lib/prompts";
import { generateReply } from "@/lib/anthropic";
import { lintReply } from "@/lib/reply-lint";
import { loadReplyGrounding } from "@/lib/reply-grounding";
import { ownerFromUser } from "@/lib/active-offer";
import { bookingLinkFor } from "@/lib/booking-url";
import { holdingTextFor } from "@/lib/handoff-reply";

const HISTORY_LIMIT = 20;
const CAPTION_MAX = 300;

/** The comment as the lead's newest turn. */
export function commentTurn(caption, commentText) {
  const cap = String(caption || "").replace(/\s+/g, " ").trim().slice(0, CAPTION_MAX);
  const comment = String(commentText || "").trim();
  return cap
    ? `They commented on your post (caption: "${cap}"): "${comment}"`
    : `They commented on your post: "${comment}"`;
}

/**
 * @param {object} admin - service-role client
 * @param {{userId: string, conversation: object|null, caption: string|null, commentText: string}} args
 *   conversation: the lead's thread, or null for a first DM (no history).
 * @returns {Promise<
 *   {kind: "reply", text: string} |
 *   {kind: "handoff", category: string, text: string} |
 *   {kind: "failed", reason: string}
 * >}
 */
export async function generateCommentReply(admin, { userId, conversation, caption, commentText }) {
  try {
    const { data: user, error: userErr } = await admin
      .from("users")
      .select(
        "id, script_config, voice_profile, full_name, instagram_username, business_name, assistant_name, holding_text, booking_url, calendly_url"
      )
      .eq("id", userId)
      .maybeSingle();
    if (userErr || !user) return { kind: "failed", reason: "user_read_failed" };
    const sc = user.script_config || {};
    // Same bar as the webhook: no script, no AI reply.
    if (!sc.greeting && !sc.offer) return { kind: "failed", reason: "no_script" };

    let rows = [];
    if (conversation?.id) {
      const { data, error: histErr } = await admin
        .from("messages")
        .select("role, content, source, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (histErr) return { kind: "failed", reason: "history_read_failed" };
      rows = data || [];
    }
    const history = [...rows]
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map((m) => ({ role: m.role, content: m.content || "", source: m.source }));

    const { activeOffer, knowledge } = await loadReplyGrounding(admin, userId);
    const bookingLink = bookingLinkFor(user);
    const systemPrompt = buildSystemPrompt(sc, bookingLink, {
      voiceProfile: user.voice_profile,
      conversation: conversation || null,
      activeOffer,
      knowledge,
      owner: ownerFromUser(user),
    });

    const raw = await generateReply(systemPrompt, [
      ...history,
      { role: "user", content: commentTurn(caption, commentText) },
    ]);
    const lint = lintReply(raw, { bookingLink });
    if (lint.handoff) {
      return { kind: "handoff", category: lint.handoff.category, text: holdingTextFor(user) };
    }
    if (lint.blocked || !lint.text?.trim()) return { kind: "failed", reason: "lint_blocked" };
    return { kind: "reply", text: lint.text.trim() };
  } catch (err) {
    console.warn("[comment-contextual-reply] failed:", err?.message);
    return { kind: "failed", reason: "generation_failed" };
  }
}
