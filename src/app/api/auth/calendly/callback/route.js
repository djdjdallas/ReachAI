import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  exchangeCodeForToken,
  getCurrentUser,
  createWebhookSubscription,
} from "@/lib/calendly";
import { encryptToken } from "@/lib/token-utils";

export async function GET(request) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    const storedState = request.cookies.get("calendly_oauth_state")?.value;
    if (!state || !storedState || state !== storedState) {
      console.error("Calendly OAuth state mismatch");
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_state`);
    }

    if (error || !code) {
      console.error("Calendly OAuth error:", error || "no code returned");
      return NextResponse.redirect(`${baseUrl}/settings?error=calendly_denied`);
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(`${baseUrl}/login?error=unauthorized`);
    }

    const tokens = await exchangeCodeForToken(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const calendlyUser = await getCurrentUser(tokens.access_token);
    const userUri = calendlyUser.uri;
    const organizationUri = calendlyUser.current_organization;
    const schedulingUrl = calendlyUser.scheduling_url;

    let webhookUri = null;
    let signingKey = null;
    let webhookError = null;

    try {
      const subscription = await createWebhookSubscription(tokens.access_token, {
        organizationUri,
        userUri,
      });
      webhookUri = subscription.uri;
      signingKey = subscription.signing_key;
    } catch (err) {
      console.error("Calendly webhook subscription failed:", err.message);
      // Free-plan users can't create webhooks. Still store the tokens so the
      // scheduling URL gets mirrored into calendly_url and DM reply flow works.
      if (err.status === 403 || /plan/i.test(err.detail || "")) {
        webhookError = "calendly_plan_limit";
      } else {
        webhookError = "calendly_webhook_failed";
      }
    }

    const admin = getSupabaseAdmin();
    await admin
      .from("users")
      .update({
        calendly_access_token: encryptToken(tokens.access_token),
        // Don't null an existing refresh token if the provider omits one.
        ...(tokens.refresh_token
          ? { calendly_refresh_token: encryptToken(tokens.refresh_token) }
          : {}),
        calendly_token_expires_at: expiresAt,
        calendly_user_uri: userUri,
        calendly_organization_uri: organizationUri,
        calendly_webhook_uri: webhookUri,
        calendly_webhook_signing_key: signingKey ? encryptToken(signingKey) : null,
        calendly_url: schedulingUrl || null,
      })
      .eq("id", user.id);

    const redirectPath = webhookError
      ? `/settings?calendly=connected&warning=${webhookError}`
      : `/settings?calendly=connected`;

    const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);
    response.cookies.set("calendly_oauth_state", "", { maxAge: 0, path: "/" });
    return response;
  } catch (err) {
    console.error("Calendly callback error:", err);
    return NextResponse.redirect(`${baseUrl}/settings?error=calendly_callback_failed`);
  }
}
