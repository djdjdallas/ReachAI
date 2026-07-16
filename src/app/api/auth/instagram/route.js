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

    // Explicit switch acknowledgment: set only when the user clicked
    // "Yes, switch account" on the settings confirm banner. The cookie
    // VALUE is the IGBA of the specific account the banner named — the
    // callback's guard only accepts a swap to exactly that account, so
    // the ack can never authorize a swap to whatever other account the
    // browser's Meta session happens to hold. httpOnly + 10 min +
    // cleared by the callback on every exit — never carries token
    // material (an IGBA is a public-ish account id, not a secret).
    const requestParams = new URL(request.url).searchParams;
    const confirmSwitch = requestParams.get("confirm_switch") === "1";
    const switchTo = requestParams.get("switch_to") || "";
    if (confirmSwitch && /^\d{1,30}$/.test(switchTo)) {
      response.cookies.set("ig_switch_ack", switchTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Instagram auth redirect error:", error.message || error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=1&error=auth_failed`
    );
  }
}
