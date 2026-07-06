import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { refreshLongLivedToken } from "@/lib/instagram";
import { encryptToken, decryptToken } from "@/lib/token-utils";
import { describeUsers, maskEmail } from "@/lib/users/identity";

// A refresh failure is unrecoverable (user must re-link) when Meta reports the
// token expired/invalid/revoked. Anything else (network blip, 5xx, rate limit)
// is transient and should retry on the next tick — Phase 2 adds retry/backoff;
// Phase 1 just classifies so alerts can distinguish the two.
function classifyRefreshError(message) {
  return /expired|invalid|revok|reauthor|permission|OAuthException/i.test(
    message || ""
  )
    ? "needs_reconnect"
    : "transient_deferred";
}

/**
 * GET /api/cron/refresh-tokens
 *
 * Refreshes Meta long-lived user access tokens that are expiring within 7 days.
 * Intended to be called by a Vercel cron job (daily).
 *
 * Secured by CRON_SECRET header to prevent unauthorized access.
 */
export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  let needsReconnect = 0;
  const results = [];

  // Resolve identity up front (one query) so per-user logs and the returned
  // payload name WHICH coach is affected instead of a bare UUID.
  const idMap = await describeUsers(
    supabase,
    (users || []).map((u) => u.id)
  );

  for (const user of users || []) {
    const who = idMap[user.id];
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
      results.push({
        user_id: user.id,
        ig: who?.igHandle || null,
        outcome: "refreshed",
        new_expires_at: expiresAt,
      });
    } catch (err) {
      const message = err?.message || "unknown";
      const outcome = classifyRefreshError(message);
      if (outcome === "needs_reconnect") needsReconnect++;

      // Greppable prefix so server logs can be filtered for cron token
      // failures, now with identity for ops triage. Settings + dashboard also
      // show an expiry banner derived from meta_token_expires_at, so a stuck
      // token won't be silent on the user side.
      console.error(
        `[refresh-tokens] user=${user.id} ig=${who?.igHandle || "?"} email=${maskEmail(who?.email)} expires_at=${user.meta_token_expires_at} outcome=${outcome} error=${message}`
      );
      failed++;
      results.push({
        user_id: user.id,
        ig: who?.igHandle || null,
        email: who?.email ? maskEmail(who.email) : null,
        outcome,
        error: message,
      });
    }
  }

  if (failed > 0) {
    console.error(
      `[refresh-tokens] summary refreshed=${refreshed} failed=${failed} needs_reconnect=${needsReconnect} total=${(users || []).length}`
    );
  }

  return NextResponse.json({
    status: "ok",
    refreshed,
    failed,
    needs_reconnect: needsReconnect,
    total: (users || []).length,
    results,
  });
}
