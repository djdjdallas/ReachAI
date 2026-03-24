import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUnipileHostedAuthLink } from "@/lib/unipile";
import crypto from "crypto";

export async function GET() {
  try {
    // Ensure user is authenticated before redirecting to Unipile
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?error=unauthorized`
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    // Generate CSRF state token to prevent cross-site request forgery
    const state = crypto.randomBytes(32).toString("hex");
    const callbackUrl = `${baseUrl}/api/auth/instagram/callback?state=${state}`;
    const webhookUrl = `${baseUrl}/api/webhooks/instagram`;

    const result = await getUnipileHostedAuthLink(callbackUrl, webhookUrl);
    const authUrl = result?.url || result?.data?.url;

    if (!authUrl) {
      console.error("No auth URL returned from Unipile:", result);
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=auth_link_failed`
      );
    }

    // Store state in a secure cookie for callback verification
    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Unipile auth redirect error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=1&error=auth_failed`
    );
  }
}
