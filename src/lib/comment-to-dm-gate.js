import { hasCommentToDM } from "@/lib/plans";
import { hasActiveAccess } from "@/lib/billing/access";

// Single source of truth for the comment-to-DM gate. Used by the webhook
// handler, the comment-to-DM pages and settings APIs, and the
// /admin/classifier routes.
//
// Plan includes the feature AND the account has access (the single access
// check, src/lib/billing/access.js). Callers must select ACCESS_COLUMNS
// (src/lib/billing/status.js); a row without them is denied.
//
// No founder email bypass: founder accounts are comped rows, which
// hasActiveAccess covers. (The old bypass was a second access path.)
export function canUseCommentToDM(profile) {
  if (!profile) return false;
  if (!hasCommentToDM(profile.plan)) return false;
  return hasActiveAccess(profile);
}
