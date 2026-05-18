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
  if (hasCommentToDM(profile.plan)) return true;
  if (isFounder(profile.email)) return true;
  return false;
}
