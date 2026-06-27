import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { exchangeGoogleCode } from "@/lib/google-calendar";
import { encryptToken } from "@/lib/token-utils";

/**
 * GET /api/auth/google-calendar/callback
 *
 * Handles the OAuth callback from Google. Exchanges the authorization code
 * for tokens, encrypts them, and stores them in the users table.
 */
export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    // Verify CSRF state
    const storedState = request.cookies.get("gcal_oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("Google Calendar OAuth state mismatch");
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`);
    }

    if (error || !code) {
      console.error("Google Calendar OAuth error:", error || "no code returned");
      return NextResponse.redirect(`${baseUrl}/settings?error=gcal_denied`);
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

    // Exchange code for tokens
    const { access_token, refresh_token, expiry_date } = await exchangeGoogleCode(code);

    // Store encrypted tokens
    const admin = getSupabaseAdmin();
    await admin
      .from("users")
      .update({
        google_calendar_access_token: encryptToken(access_token),
        // Google only returns a refresh token on first consent; don't wipe the
        // stored one on a re-auth that omits it.
        ...(refresh_token
          ? { google_calendar_refresh_token: encryptToken(refresh_token) }
          : {}),
        google_calendar_token_expires_at: new Date(expiry_date).toISOString(),
      })
      .eq("id", user.id);

    const response = NextResponse.redirect(`${baseUrl}/settings?google_calendar=connected`);
    response.cookies.set("gcal_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("Google Calendar callback error:", err);
    return NextResponse.redirect(`${baseUrl}/settings?error=gcal_callback_failed`);
  }
}
