import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getInstagramProfile,
} from "@/lib/instagram";
import { encrypt } from "@/lib/encryption";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      console.error("Instagram OAuth error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=1&error=oauth_denied`
      );
    }

    // Authenticate user
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

    // Exchange code for short-lived token
    const tokenData = await exchangeCodeForToken(code);
    const shortLivedToken = tokenData.access_token;

    // Exchange for long-lived token
    const longLivedData = await getLongLivedToken(shortLivedToken);
    const longLivedToken = longLivedData.access_token;

    // Get Instagram profile
    const profile = await getInstagramProfile(longLivedToken);

    // Encrypt the long-lived token
    const encryptedToken = encrypt(longLivedToken);

    // Save to user's record in Supabase
    const { error: updateError } = await supabase
      .from("users")
      .update({
        instagram_token: encryptedToken,
        instagram_user_id: profile.id,
        instagram_page_id: profile.instagram_business_account?.id || profile.id,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to save Instagram credentials:", updateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=1&error=save_failed`
      );
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=2`
    );
  } catch (error) {
    console.error("Instagram callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/onboarding?step=1&error=callback_failed`
    );
  }
}
