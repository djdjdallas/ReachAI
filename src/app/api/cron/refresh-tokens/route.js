import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { refreshLongLivedToken } from "@/lib/instagram";
import { encryptToken, decryptToken } from "@/lib/token-utils";
import { assertCron } from "@/lib/auth/cron";

/**
 * GET /api/cron/refresh-tokens
 *
 * Refreshes Meta long-lived user access tokens that are expiring within 7 days.
 * Intended to be called by a Vercel cron job (daily).
 *
 * Secured by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(request) {
  const denied = assertCron(request);
  if (denied) return denied;

  const supabase = getSupabaseAdmin();

  // Find users whose Meta token expires within 7 days
  const sevenDaysFromNow = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: users, error } = await supabase
    .from("users")
    .select("id, meta_user_access_token, meta_token_expires_at")
    .not("meta_user_access_token", "is", null)
    .lt("meta_token_expires_at", sevenDaysFromNow);

  if (error) {
    console.error("Failed to query users for token refresh:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  let refreshed = 0;
  let failed = 0;

  for (const user of users || []) {
    try {
      const { accessToken, expiresIn } = await refreshLongLivedToken(
        decryptToken(user.meta_user_access_token)
      );

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      await supabase
        .from("users")
        .update({
          meta_user_access_token: encryptToken(accessToken),
          meta_page_access_token: encryptToken(accessToken),
          meta_token_expires_at: expiresAt,
        })
        .eq("id", user.id);

      refreshed++;
    } catch (err) {
      // Greppable prefix so server logs can be filtered for cron token
      // failures. Settings + dashboard now show an expiry banner derived
      // from meta_token_expires_at, so a stuck token won't be silent on
      // the user side; this log is for ops triage.
      console.error(
        `[refresh-tokens] user=${user.id} expires_at=${user.meta_token_expires_at} error=${err?.message || "unknown"}`
      );
      failed++;
    }
  }

  if (failed > 0) {
    console.error(
      `[refresh-tokens] summary refreshed=${refreshed} failed=${failed} total=${(users || []).length}`
    );
  }

  return NextResponse.json({
    status: "ok",
    refreshed,
    failed,
    total: (users || []).length,
  });
}
