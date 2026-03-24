import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const error = searchParams.get("error");
    const state = searchParams.get("state");

    if (error || !accountId) {
      console.error("Unipile callback error:", error);
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=oauth_denied`
      );
    }

    // Verify CSRF state token
    const storedState = request.cookies.get("oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("OAuth state mismatch — possible CSRF attack");
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
      return NextResponse.redirect(
        `${baseUrl}/login?error=unauthorized`
      );
    }

    // Save the Unipile account ID to the user's record
    const { error: updateError } = await supabase
      .from("users")
      .update({
        unipile_account_id: accountId,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to save Unipile account ID:", updateError);
      return NextResponse.redirect(
        `${baseUrl}/onboarding?step=1&error=save_failed`
      );
    }

    // Clear the state cookie
    const response = NextResponse.redirect(
      `${baseUrl}/onboarding?step=2`
    );
    response.cookies.set("oauth_state", "", { maxAge: 0, path: "/" });

    return response;
  } catch (error) {
    console.error("Unipile callback error:", error);
    return NextResponse.redirect(
      `${baseUrl}/onboarding?step=1&error=callback_failed`
    );
  }
}
