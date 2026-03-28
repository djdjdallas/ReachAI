import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  exchangeCodeForToken,
  getUserPagesWithInstagram,
  subscribePageToWebhooks,
} from "@/lib/instagram";

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const method = searchParams.get("method");

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

    // ── Unipile fallback path ──────────────────────────────────────────
    if (method === "unipile") {
      const accountId = searchParams.get("account_id");

      if (error || !accountId) {
        console.error("Unipile callback error:", error);
        return NextResponse.redirect(
          `${baseUrl}/onboarding?step=1&error=oauth_denied`
        );
      }

      await admin
        .from("users")
        .update({ unipile_account_id: accountId })
        .eq("id", user.id);

      const response = NextResponse.redirect(`${baseUrl}/onboarding?step=2`);
      response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
      return response;
    }

    // ── Meta OAuth path ────────────────────────────────────────────────
    const code = searchParams.get("code");

    if (error || !code) {
      console.error("Meta OAuth error:", error || "no code returned");
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=oauth_denied`
      );
    }

    // Exchange code for long-lived user token
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);

    // Find pages with connected Instagram Business accounts
    const pages = await getUserPagesWithInstagram(accessToken);
    const pageWithIg = pages.find((p) => p.instagramAccountId);

    if (!pageWithIg) {
      console.error("No Instagram Business account found on any page");
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=no_instagram_account`
      );
    }

    // Subscribe page to webhooks so we receive DM events
    try {
      await subscribePageToWebhooks(pageWithIg.pageId, pageWithIg.pageAccessToken);
    } catch (err) {
      console.error("Failed to subscribe page to webhooks:", err.message);
      // Non-fatal — continue saving. Webhooks can be re-subscribed later.
    }

    // Save Meta connection details
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await admin
      .from("users")
      .update({
        meta_page_id: pageWithIg.pageId,
        meta_page_access_token: pageWithIg.pageAccessToken,
        instagram_business_account_id: pageWithIg.instagramAccountId,
        meta_user_access_token: accessToken,
        meta_token_expires_at: expiresAt,
      })
      .eq("id", user.id);

    const response = NextResponse.redirect(`${baseUrl}/onboarding?step=2`);
    response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("Instagram callback error:", err);
    return NextResponse.redirect(
      `${baseUrl}/onboarding?step=1&error=callback_failed`
    );
  }
}
