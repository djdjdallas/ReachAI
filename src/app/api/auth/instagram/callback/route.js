import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForToken } from "@/lib/instagram";

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

    // Save Instagram connection details
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await admin
      .from("users")
      .update({
        instagram_business_account_id: userId,
        meta_page_access_token: accessToken,
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
