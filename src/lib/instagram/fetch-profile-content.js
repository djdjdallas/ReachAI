/**
 * fetch-profile-content.js
 *
 * Reads a coach's Instagram bio + recent captioned posts via the Meta
 * Graph API. Used by the post-OAuth voice-profile auto-import pipeline.
 *
 * Permissions required (already covered by the in-review submission):
 *   - instagram_business_basic
 *
 * The caller is responsible for decrypting the access token; nothing from
 * this module is ever returned to the client.
 */

import { decryptToken } from "@/lib/token-utils";

const GRAPH_API_VERSION = "v21.0";
const IG_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_API_VERSION}`;

/**
 * Custom error type so the caller can distinguish Graph API failures from
 * unexpected exceptions and log them with the right `reason` tag.
 */
export class InstagramFetchError extends Error {
  constructor(message, { kind = "graph_error", status = null, raw = null } = {}) {
    super(message);
    this.name = "InstagramFetchError";
    this.kind = kind;
    this.status = status;
    this.raw = raw;
  }
}

/**
 * Fetches bio + 3 most recent captioned posts for a user.
 *
 * @param {object} userRow - row from public.users, must include
 *   meta_user_access_token (encrypted) and instagram_business_account_id
 * @returns {Promise<null | {
 *   bio: string,
 *   name: string | null,
 *   username: string | null,
 *   captions: Array<{ text: string, timestamp: string }>
 * }>} Returns null when the account has no usable signal (empty bio AND
 *   zero captioned posts).
 */
export async function fetchProfileContent(userRow) {
  if (!userRow?.meta_user_access_token) {
    throw new InstagramFetchError("Missing access token", {
      kind: "no_token",
    });
  }

  const accessToken = decryptToken(userRow.meta_user_access_token);
  if (!accessToken) {
    throw new InstagramFetchError("Failed to decrypt access token", {
      kind: "no_token",
    });
  }

  const meUrl =
    `${IG_GRAPH_BASE}/me` +
    `?fields=username,name,biography,account_type` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const meRes = await fetch(meUrl, { cache: "no-store" });
  const meData = await meRes.json().catch(() => ({}));

  if (!meRes.ok || meData?.error) {
    const code = meData?.error?.code;
    const sub = meData?.error?.error_subcode;
    // 190 / 102 / 463 → invalid or expired token. 4 / 17 / 32 / 613 → rate limit.
    const isTokenInvalid =
      meRes.status === 401 ||
      code === 190 ||
      code === 102 ||
      code === 463;
    const isRateLimited =
      meRes.status === 429 ||
      code === 4 ||
      code === 17 ||
      code === 32 ||
      code === 613;

    throw new InstagramFetchError(
      meData?.error?.message || `Graph API /me failed with ${meRes.status}`,
      {
        kind: isTokenInvalid
          ? "token_invalid"
          : isRateLimited
          ? "rate_limit"
          : "graph_error",
        status: meRes.status,
        raw: { code, sub },
      }
    );
  }

  const bio = typeof meData.biography === "string" ? meData.biography.trim() : "";
  const name = typeof meData.name === "string" ? meData.name.trim() || null : null;
  const username =
    typeof meData.username === "string" ? meData.username.trim() || null : null;

  // Fetch up to 10 media items; filter for non-empty captions, take 3 newest.
  const mediaUrl =
    `${IG_GRAPH_BASE}/me/media` +
    `?fields=caption,media_type,timestamp` +
    `&limit=10` +
    `&access_token=${encodeURIComponent(accessToken)}`;

  const mediaRes = await fetch(mediaUrl, { cache: "no-store" });
  const mediaData = await mediaRes.json().catch(() => ({}));

  if (!mediaRes.ok || mediaData?.error) {
    const code = mediaData?.error?.code;
    const isTokenInvalid =
      mediaRes.status === 401 || code === 190 || code === 102 || code === 463;
    const isRateLimited =
      mediaRes.status === 429 ||
      code === 4 ||
      code === 17 ||
      code === 32 ||
      code === 613;

    throw new InstagramFetchError(
      mediaData?.error?.message ||
        `Graph API /me/media failed with ${mediaRes.status}`,
      {
        kind: isTokenInvalid
          ? "token_invalid"
          : isRateLimited
          ? "rate_limit"
          : "graph_error",
        status: mediaRes.status,
      }
    );
  }

  const mediaItems = Array.isArray(mediaData?.data) ? mediaData.data : [];
  const captions = mediaItems
    .filter((m) => typeof m?.caption === "string" && m.caption.trim().length > 0)
    .slice(0, 3)
    .map((m) => ({
      text: m.caption.trim(),
      timestamp: m.timestamp || "",
    }));

  if (!bio && captions.length === 0) {
    return null;
  }

  return { bio, name, username, captions };
}
