import { hasCommentToDM } from "@/lib/plans";
import { isFounder } from "@/lib/founder";

// Single source of truth for the comment-to-DM access gate. Used by the
// webhook handler, the /api/admin/classify routes, and the /admin/classifier
// page so a plan-tier or founder-list change only has to land in one place.
//
// The founder bypass is intentional — Dom needs to dogfood the feature on
// his own account regardless of plan, and trial-tier coaches without a paid
// plan still need a way to QA the pipeline during the rollout window.
export function canUseCommentToDM(profile) {
  if (!profile) return false;
  if (isFounder(profile.email)) return true;
  if (!hasCommentToDM(profile.plan)) return false;
  // Callers that pass subscription_status (the webhook comment branch — the
  // path that spends money) also require a live subscription. Callers that
  // don't pass it keep plan-only behavior; plan is reset to 'base' on
  // cancellation by the Stripe webhook, so this is defense in depth against
  // missed/out-of-order Stripe events, not the primary gate.
  if (
    profile.subscription_status !== undefined &&
    !["active", "trialing"].includes(profile.subscription_status)
  ) {
    return false;
  }
  return true;
}
