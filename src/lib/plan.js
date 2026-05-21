import { isFounder } from "@/lib/founder";

/**
 * Returns true when the user is allowed to use the Voice Replies feature.
 *
 * Gating rules:
 *   - Founders (dominickjerell@gmail.com and anyone in FOUNDER_EMAILS) bypass
 *     the subscription gate so we can dogfood freely on the production
 *     account.
 *   - Everyone else needs plan === 'unlimited' AND a subscription_status of
 *     'active' or 'trialing'. 'base' does NOT include voice replies.
 *
 * Important: founder bypass covers the SUBSCRIPTION gate only. The
 * per-user kill switch (users.voice_replies_enabled) is enforced separately
 * inside the matcher (src/lib/voice/matcher.js) so a founder cannot
 * accidentally voice-reply from the Meta App Review test account while it
 * is being inspected.
 *
 * @param {object} user - public.users row (must include plan, email,
 *                        subscription_status)
 * @returns {boolean}
 */
export function canUseVoiceReplies(user) {
  if (!user) return false;
  if (isFounder(user.email)) return true;
  if (user.plan !== "unlimited") return false;
  return user.subscription_status === "active" || user.subscription_status === "trialing";
}
