import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOAuthUrl } from "@/lib/instagram";
import { getUnipileHostedAuthLink } from "@/lib/unipile";
import crypto from "crypto";

export async function GET(request) {
  try {
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
    const state = crypto.randomBytes(32).toString("hex");

    // Check if the request is for the Unipile fallback
    const { searchParams } = new URL(request.url);
    const method = searchParams.get("method");

    let authUrl;

    if (method === "unipile") {
      // Unipile fallback path
      const callbackUrl = `${baseUrl}/api/auth/instagram/callback?state=${state}&method=unipile`;
      const webhookUrl = `${baseUrl}/api/webhooks/instagram`;
      const result = await getUnipileHostedAuthLink(callbackUrl, webhookUrl);
      authUrl = result?.url || result?.data?.url;

      if (!authUrl) {
        console.error("No auth URL returned from Unipile:", result);
        return NextResponse.redirect(
          `${baseUrl}/onboarding?step=1&error=auth_link_failed`
        );
      }
    } else {
      // Primary path: Meta Facebook Login
      authUrl = getOAuthUrl(state);
      console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL);
      console.log("INSTAGRAM_APP_ID:", process.env.INSTAGRAM_APP_ID ? "SET" : "MISSING");
      console.log("Full OAuth URL:", authUrl);
    }

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Instagram auth redirect error:", error.message || error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=1&error=auth_failed`
    );
  }
}
