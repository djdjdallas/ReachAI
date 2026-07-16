import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/token-utils";

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

    const { data: profile } = await supabase
      .from("users")
      .select(
        "instagram_business_account_id, meta_page_access_token"
      )
      .eq("id", user.id)
      .single();

    // Un-subscribe the IG business account from our webhook so future events
    // don't route to a freed connection. Best-effort: if the token has already
    // been revoked on Meta's side, log and continue to clear the DB row.
    if (
      profile?.instagram_business_account_id &&
      profile?.meta_page_access_token
    ) {
      try {
        const token = decryptToken(profile.meta_page_access_token);
        const res = await fetch(
          `https://graph.instagram.com/v21.0/${profile.instagram_business_account_id}/subscribed_apps?access_token=${encodeURIComponent(token)}`,
          { method: "DELETE" }
        );
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn(
            "[ig-disconnect] subscribed_apps DELETE non-OK:",
            res.status,
            body.slice(0, 200)
          );
        }
      } catch (err) {
        console.warn(
          "[ig-disconnect] subscribed_apps DELETE failed:",
          err?.message
        );
      }
    }

    // Clear all connection fields
    await supabase
      .from("users")
      .update({
        instagram_business_account_id: null,
        meta_page_id: null,
        meta_page_access_token: null,
        meta_user_access_token: null,
        meta_token_expires_at: null,
      })
      .eq("id", user.id);

    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
