import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { deleteWebhookSubscription, withFreshToken } from "@/lib/calendly";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("users")
      .select(
        "id, calendly_access_token, calendly_refresh_token, calendly_token_expires_at, calendly_webhook_uri"
      )
      .eq("id", user.id)
      .single();

    if (profile?.calendly_webhook_uri && profile?.calendly_access_token) {
      try {
        const accessToken = await withFreshToken(profile);
        await deleteWebhookSubscription(accessToken, profile.calendly_webhook_uri);
      } catch (err) {
        console.warn("[calendly-disconnect] webhook delete failed:", err?.message);
      }
    }

    await admin
      .from("users")
      .update({
        calendly_access_token: null,
        calendly_refresh_token: null,
        calendly_token_expires_at: null,
        calendly_user_uri: null,
        calendly_organization_uri: null,
        calendly_webhook_uri: null,
        calendly_webhook_signing_key: null,
        calendly_url: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  } catch (error) {
    console.error("Calendly disconnect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
