import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleOAuthUrl } from "@/lib/google-calendar";
import crypto from "crypto";

/**
 * GET /api/auth/google-calendar
 *
 * Initiates Google Calendar OAuth flow.
 * Generates a CSRF state token, stores it in a cookie, and redirects
 * the user to Google's consent screen.
 */
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error("Google Calendar OAuth not configured: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return NextResponse.redirect(`${baseUrl}/settings?error=gcal_not_configured`);
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(`${baseUrl}/login?error=unauthorized`);
    }

    const state = crypto.randomBytes(32).toString("hex");
    const authUrl = getGoogleOAuthUrl(state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("gcal_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Google Calendar auth redirect error:", error.message || error);
    return NextResponse.redirect(`${baseUrl}/settings?error=gcal_auth_failed`);
  }
}
