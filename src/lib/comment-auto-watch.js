// Auto-watch for managed accounts (users.billing_managed = true): a comment
// on a post with no monitoring row is handled as if the post were watched
// with the default actions per class, instead of skipped. The monitoring
// row is created on that first comment, so the post shows in the picker
// from then on.
//
// Only a post with NO row is auto-watched. A post the account turned off
// has a row with enabled = false and stays off. Coach accounts never reach
// this module (src/lib/webhooks/comment-event.js checks isAutoWatchAccount
// first).
//
// Ad comments: only the organic post the ad runs (original_media_id), and
// only when that post is the account's own. The ad's own media is never
// auto-watched: the picker can't show it.

import { getOwnMedia } from "@/lib/instagram";
import { isBillingManaged } from "@/lib/billing/managed";

/** Whether the account gets auto-watch: managed accounts. */
export function isAutoWatchAccount(user) {
  return isBillingManaged(user);
}

/**
 * Whether a comment came in on an ad or boosted post (value.media from the
 * webhook): an ad id, or an original_media_id that differs from media.id.
 */
export function isAdComment(media) {
  const original = media?.original_media_id || null;
  return Boolean(media?.ad_id) || Boolean(original && original !== media?.id);
}

/**
 * The posts row for an ad's original post that Clinchd hasn't seen yet:
 * created only when Meta confirms the media is the account's own. Returns
 * the row, or null (not owned, unreadable, or the insert failed).
 *
 * @param {object} admin - service-role client
 * @param {{creatorId: string, mediaId: string, igAccountId: string, token: string|null}} args
 */
export async function ingestOwnedPost(admin, { creatorId, mediaId, igAccountId, token }) {
  try {
    if (!token || !mediaId) return null;
    const media = await getOwnMedia(mediaId, token, igAccountId);
    if (!media) return null;
    const { data, error } = await admin
      .from("posts")
      .insert({
        creator_id: creatorId,
        ig_media_id: mediaId,
        caption: media.caption,
        permalink: media.permalink,
        media_type: media.media_type,
        posted_at: new Date().toISOString(),
      })
      .select("id, caption, ig_media_id, creator_id")
      .single();
    if (error) {
      console.warn("[auto-watch] post insert failed:", { mediaId, code: error.code });
      return null;
    }
    return data;
  } catch (err) {
    console.warn("[auto-watch] ingest threw:", { mediaId, error: err?.message });
    return null;
  }
}

/**
 * Start watching a post: fill its caption from Meta when Clinchd has none
 * (the classifier grounds on it), then create the monitoring row with the
 * defaults (enabled, no per-class overrides, no treatment tag). Returns the
 * post with any caption filled in. Never throws; a concurrent comment
 * creating the row first is fine (the caller re-reads it).
 *
 * @param {object} admin - service-role client
 * @param {{creatorId: string, postRow: object, igAccountId: string, token: string|null}} args
 * @returns {Promise<object>} postRow
 */
export async function autoWatchPost(admin, { creatorId, postRow, igAccountId, token }) {
  let post = postRow;
  try {
    if (!post.caption && token) {
      const media = await getOwnMedia(post.ig_media_id, token, igAccountId);
      if (media) {
        const patch = Object.fromEntries(Object.entries(media).filter(([, v]) => v != null));
        if (Object.keys(patch).length) {
          await admin.from("posts").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", post.id);
          post = { ...post, ...patch };
        }
      }
    }
    const { error } = await admin
      .from("post_monitoring_settings")
      .upsert(
        { creator_id: creatorId, post_id: post.id, enabled: true, actions_per_class: null },
        { onConflict: "creator_id,post_id", ignoreDuplicates: true }
      );
    if (error) console.warn("[auto-watch] monitoring insert failed:", { postId: post.id, code: error.code });
  } catch (err) {
    console.warn("[auto-watch] threw:", { postId: post?.id, error: err?.message });
  }
  return post;
}
