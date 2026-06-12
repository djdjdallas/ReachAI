import { postPublicCommentReply } from "@/lib/instagram";
import { getPostHogClient } from "@/lib/posthog-server";

// Optional public reply under a trigger comment, posted AFTER the
// comment-to-DM private reply succeeds. Opt-in per user via
// users.comment_public_reply_enabled (NOT NULL DEFAULT FALSE).
//
// The varied pool is the core safety mechanism, not decoration: posting an
// identical reply on every trigger comment is exactly the repetitive-action
// pattern Meta's spam classifier flags (it already earned a 30-day
// restriction on the outreach surface). Hence pickReplyTemplate's
// anti-repeat rule below.
//
// Contract: maybePostPublicReply NEVER throws and never affects the DM that
// already went out — every failure path logs and returns.

// Picks a random active template whose text differs from the last reply
// posted on this post. Falls back to the full pool only when no template
// differs (i.e. a single-template pool, where repetition is unavoidable
// and explicitly allowed). With 2+ distinct texts the same reply can never
// post twice in a row on the same post.
export function pickReplyTemplate(activeTemplates, lastReplyText) {
  const pool = (activeTemplates || []).filter(
    (t) => typeof t?.reply_text === "string" && t.reply_text.trim().length > 0
  );
  if (pool.length === 0) return null;

  const fresh = pool.filter((t) => t.reply_text !== lastReplyText);
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export async function maybePostPublicReply({
  admin,
  ownerUser,
  postId,
  commentId,
  lastReplyText,
  pageToken,
}) {
  try {
    // Kill switch — default state for every user. Anything but an explicit
    // true preserves pre-feature behavior exactly.
    if (ownerUser?.comment_public_reply_enabled !== true) return;
    if (!pageToken) return;

    const { data: templates, error: tplErr } = await admin
      .from("comment_reply_templates")
      .select("id, reply_text")
      .eq("user_id", ownerUser.id)
      .eq("is_active", true);

    if (tplErr) {
      console.warn("[comment-public-reply] template fetch failed:", {
        commentId,
        error: tplErr.message,
      });
      return;
    }

    const picked = pickReplyTemplate(templates, lastReplyText);
    // Feature on but zero usable templates → silently inert, by design.
    if (!picked) return;

    const result = await postPublicCommentReply(commentId, picked.reply_text, pageToken);

    if (!result.success) {
      console.warn("[comment-public-reply] post failed:", {
        commentId,
        error: result.error,
        retryable: result.retryable,
      });
      getPostHogClient().capture({
        distinctId: ownerUser.email || ownerUser.id,
        event: "comment_public_reply_failed",
        properties: {
          user_id: ownerUser.id,
          post_id: postId,
          error: result.error,
          retryable: result.retryable === true,
        },
      });
      return;
    }

    // Record the text for the anti-repeat rule. A failure here only risks
    // one repeated phrasing on the next trigger — log and move on.
    const { error: updErr } = await admin
      .from("post_monitoring_settings")
      .update({ last_public_reply_text: picked.reply_text })
      .eq("creator_id", ownerUser.id)
      .eq("post_id", postId);
    if (updErr) {
      console.warn("[comment-public-reply] last-reply update failed:", {
        commentId,
        error: updErr.message,
      });
    }

    getPostHogClient().capture({
      distinctId: ownerUser.email || ownerUser.id,
      event: "comment_public_reply_posted",
      properties: {
        user_id: ownerUser.id,
        post_id: postId,
        reply_text_length: picked.reply_text.length,
        template_count_active: templates.length,
      },
    });
  } catch (err) {
    console.warn("[comment-public-reply] threw:", { commentId, error: err?.message });
    try {
      getPostHogClient().capture({
        distinctId: ownerUser?.email || ownerUser?.id || "unknown",
        event: "comment_public_reply_failed",
        properties: {
          user_id: ownerUser?.id || null,
          post_id: postId || null,
          error: err?.message || "unknown",
        },
      });
    } catch {
      // PostHog itself failing must not surface into the webhook path.
    }
  }
}
