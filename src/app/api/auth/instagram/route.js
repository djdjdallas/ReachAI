import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOAuthUrl } from "@/lib/instagram";
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

    const authUrl = getOAuthUrl(state);

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
