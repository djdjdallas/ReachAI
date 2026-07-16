import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/token-utils";
import { missingWebhookFields } from "@/lib/instagram-webhook-fields";

export const dynamic = "force-dynamic";

/**
 * GET /api/instagram/connection-health
 *
 * Settings-only check of the session user's Instagram connection: reads the
 * webhook fields Meta actually holds for their account and compares them
 * against the canonical REQUIRED_WEBHOOK_FIELDS list. Hits Meta on every
 * call, so dashboard-wide UI (the connected-account badge) must read the
 * users row instead of calling this.
 *
 * Never leaks token material or raw Meta error bodies to the client — a
 * failed verification returns { healthy: false, error: "verification_failed" }
 * with a 200 and logs the detail server-side.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await getSupabaseAdmin()
      .from("users")
      .select(
        "instagram_business_account_id, instagram_username, meta_page_access_token"
      )
      .eq("id", user.id)
      .single();

    if (!profile?.instagram_business_account_id) {
      return NextResponse.json({ connected: false });
    }

    const base = {
      connected: true,
      username: profile.instagram_username || null,
      igba: profile.instagram_business_account_id,
    };

    if (!profile.meta_page_access_token) {
      return NextResponse.json({
        ...base,
        healthy: false,
        error: "verification_failed",
      });
    }

    try {
      // Tokens are encrypted at rest — ALWAYS decrypt before calling Meta.
      const token = decryptToken(profile.meta_page_access_token);
      const res = await fetch(
        `https://graph.instagram.com/v21.0/${profile.instagram_business_account_id}/subscribed_apps?access_token=${encodeURIComponent(token)}`
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.error) {
        console.error(
          "[connection-health] subscribed_apps GET failed:",
          res.status,
          data?.error?.message
        );
        return NextResponse.json({
          ...base,
          healthy: false,
          error: "verification_failed",
        });
      }

      const subscribed = data?.data?.[0]?.subscribed_fields || [];
      const missing = missingWebhookFields(subscribed);
      return NextResponse.json({
        ...base,
        subscribed_fields: subscribed,
        missing_fields: missing,
        healthy: missing.length === 0,
      });
    } catch (err) {
      console.error("[connection-health] verify threw:", err?.message);
      return NextResponse.json({
        ...base,
        healthy: false,
        error: "verification_failed",
      });
    }
  } catch (err) {
    console.error("[connection-health] failed:", err?.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
