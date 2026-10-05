import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Clears the Google Calendar connection. Server-side with the admin client
// because the browser can't write token columns on users: browser UPDATE is
// an allowlist (migration 20261005150000) and tokens aren't on it. The
// Settings page used to null these three columns itself.
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

    const { error } = await getSupabaseAdmin()
      .from("users")
      .update({
        google_calendar_access_token: null,
        google_calendar_refresh_token: null,
        google_calendar_token_expires_at: null,
      })
      .eq("id", user.id);
    if (error) throw error;

    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  } catch (error) {
    console.error("Google Calendar disconnect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
