import { hasActiveAccess } from "@/lib/billing/access";

/**
 * Voice Replies: Unlimited plan AND access (the single access check,
 * src/lib/billing/access.js). 'base' does not include voice replies.
 *
 * The per-user kill switch (users.voice_replies_enabled) is enforced
 * separately inside the matcher (src/lib/voice/matcher.js).
 *
 * No founder email bypass: founder accounts are comped rows, which
 * hasActiveAccess covers.
 *
 * @param {object} user - public.users row; must include ACCESS_COLUMNS
 *   (src/lib/billing/status.js)
 * @returns {boolean}
 */
export function canUseVoiceReplies(user) {
  if (!user) return false;
  if (user.plan !== "unlimited") return false;
  return hasActiveAccess(user);
}

/**
 * Drip Sequences (in-window follow-up nudges): Unlimited plan AND access.
 * Mirrors canUseVoiceReplies.
 *
 * The per-user master toggle (users.drip_enabled) is the kill switch for
 * everyone; it is checked at enqueue time (webhook Insertion C) and again
 * at fire time (drip processor, Condition 1).
 *
 * @param {object} user - public.users row; must include ACCESS_COLUMNS
 * @returns {boolean}
 */
export function canUseDripSequences(user) {
  if (!user) return false;
  if (user.plan !== "unlimited") return false;
  return hasActiveAccess(user);
}
