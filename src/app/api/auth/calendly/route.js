import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizeUrl, getCalendlyRedirectUri } from "@/lib/calendly";

// Where the callback sends the coach afterwards. Allowlisted: "onboarding"
// (Step 2's Connect Calendly button) or the default, Settings.
const RETURN_TARGETS = new Set(["onboarding", "settings"]);

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  const requested = new URL(request.url).searchParams.get("return");
  const returnTo = RETURN_TARGETS.has(requested) ? requested : "settings";
  const errorBase =
    returnTo === "onboarding" ? `${baseUrl}/onboarding?step=2&calendly=error&reason=` : `${baseUrl}/settings?error=`;

  if (!process.env.CALENDLY_CLIENT_ID || !process.env.CALENDLY_CLIENT_SECRET) {
    console.error("Calendly OAuth not configured: missing CALENDLY_CLIENT_ID or CALENDLY_CLIENT_SECRET");
    return NextResponse.redirect(`${errorBase}calendly_not_configured`);
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
    console.info("[calendly-oauth] redirect_uri:", getCalendlyRedirectUri());
    const authUrl = getAuthorizeUrl(state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("calendly_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    response.cookies.set("calendly_return", returnTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Calendly auth redirect error:", error.message || error);
    return NextResponse.redirect(`${errorBase}calendly_auth_failed`);
  }
}
