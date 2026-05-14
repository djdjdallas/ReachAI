import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizeUrl, getCalendlyRedirectUri } from "@/lib/calendly";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!process.env.CALENDLY_CLIENT_ID || !process.env.CALENDLY_CLIENT_SECRET) {
    console.error("Calendly OAuth not configured: missing CALENDLY_CLIENT_ID or CALENDLY_CLIENT_SECRET");
    return NextResponse.redirect(`${baseUrl}/settings?error=calendly_not_configured`);
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

    return response;
  } catch (error) {
    console.error("Calendly auth redirect error:", error.message || error);
    return NextResponse.redirect(`${baseUrl}/settings?error=calendly_auth_failed`);
  }
}
