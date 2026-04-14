import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForToken } from "@/lib/instagram";
import { encryptToken } from "@/lib/token-utils";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Verify CSRF state
    const storedState = request.cookies.get("oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("OAuth state mismatch");
      getPostHogClient().capture({
        distinctId: "anonymous",
        event: "instagram_connection_failed",
        properties: { reason: "invalid_state" },
      });
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=invalid_state`
      );
    }

    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(`${baseUrl}/login?error=unauthorized`);
    }

    const admin = getSupabaseAdmin();

    // Check whether the user has already completed onboarding so we can
    // route reconnections to /settings instead of back into the funnel.
    const { data: profile } = await admin
      .from("users")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();
    const successRedirect = profile?.onboarding_completed
      ? `${baseUrl}/settings`
      : `${baseUrl}/onboarding?step=2`;

    // ── Instagram Login OAuth path ───────────────────────────────────
    const code = searchParams.get("code");

    if (error || !code) {
      console.error("Instagram OAuth error:", error || "no code returned");
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "instagram_connection_failed",
        properties: { reason: "oauth_denied" },
      });
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=oauth_denied`
      );
    }

    // Exchange code for long-lived token + Instagram user ID
    const { accessToken, expiresIn, userId } = await exchangeCodeForToken(code);
    void userId;

    // Fetch the Instagram Business Account ID (IGBA ID) — the 17841… format
    // that Meta Dashboard shows and that the webhook fires with.
    //
    // IMPORTANT: /me?fields=id returns the Instagram-Scoped User ID (the short
    // 269… format, per-app). The actual IGBA ID lives in the `user_id` field
    // when you request it explicitly. We query both so the logs make the
    // difference obvious if Meta ever changes this again.
    let igbaId = null;
    var igUsername = null;
    try {
      const meRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,user_id,username&access_token=${accessToken}`
      );
      const meData = await meRes.json();

      if (meData.user_id) {
        igbaId = meData.user_id;
      }
      // No fallback to meData.id — that is the IGSID, which will never match
      // the webhook `recipient.id`. Better to fail the connect and let the
      // user retry than silently save a broken account.
      igUsername = meData.username || null;
    } catch (err) {
      console.error("[ig-callback] Failed to fetch /me:", err?.message);
    }

    if (!igbaId) {
      console.error(
        "[ig-callback] No IGBA ID resolved from /me. Aborting token save and redirecting with error."
      );
      getPostHogClient().capture({
        distinctId: user.email || user.id,
        event: "instagram_connection_failed",
        properties: { reason: "no_igba_id" },
      });
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=no_igba_id`
      );
    }

    // Save Instagram connection details
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await admin
      .from("users")
      .update({
        instagram_business_account_id: igbaId,
        instagram_username: igUsername || null,
        meta_page_access_token: encryptToken(accessToken),
        meta_user_access_token: encryptToken(accessToken),
        meta_token_expires_at: expiresAt,
      })
      .eq("id", user.id);

    // Subscribe this IG business account to our webhook so Meta starts
    // firing incoming DM events. Non-blocking: log failures and continue to
    // the redirect — the user can reconnect / re-subscribe later if needed.
    try {
      const subRes = await fetch(
        `https://graph.instagram.com/v21.0/${igbaId}/subscribed_apps`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            subscribed_fields: "messages,messaging_postbacks",
            access_token: accessToken,
          }),
        }
      );
      const subData = await subRes.json().catch(() => ({}));
      if (!subRes.ok || subData?.error) {
        console.error(
          "[ig-callback] subscribe_apps failed:",
          subRes.status,
          subData?.error?.message
        );
      }
    } catch (subErr) {
      console.error("[ig-callback] subscribe_apps threw:", subErr?.message);
    }

    const response = NextResponse.redirect(successRedirect);
    response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("Instagram callback error:", err);
    getPostHogClient().capture({
      distinctId: "anonymous",
      event: "instagram_connection_failed",
      properties: { reason: "callback_error" },
    });
    return NextResponse.redirect(
      `${baseUrl}/onboarding?step=1&error=callback_failed`
    );
  }
}
