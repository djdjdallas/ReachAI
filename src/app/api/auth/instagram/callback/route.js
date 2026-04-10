import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForToken } from "@/lib/instagram";
import { encryptToken } from "@/lib/token-utils";

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
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=oauth_denied`
      );
    }

    // Exchange code for long-lived token + Instagram user ID
    const { accessToken, expiresIn, userId } = await exchangeCodeForToken(code);

    // Fetch the Instagram Business Account ID (IGBA ID) which is what
    // Meta uses in webhook payloads — different from the OAuth user ID
    let igbaId = userId;
    try {
      const meRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${accessToken}`
      );
      const meData = await meRes.json();
      if (meData.id) {
        igbaId = meData.id;
      }
      // Save username for display on settings page
      var igUsername = meData.username || null;
    } catch (err) {
      console.error("Failed to fetch IGBA ID, using OAuth user ID:", err.message);
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
          subData
        );
      } else {
        console.log("[ig-callback] subscribe_apps ok:", igbaId, subData);
      }
    } catch (subErr) {
      console.error("[ig-callback] subscribe_apps threw:", subErr?.message);
    }

    const response = NextResponse.redirect(successRedirect);
    response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("Instagram callback error:", err);
    return NextResponse.redirect(
      `${baseUrl}/onboarding?step=1&error=callback_failed`
    );
  }
}
