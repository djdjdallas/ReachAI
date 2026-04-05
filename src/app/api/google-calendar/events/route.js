import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { fetchCalendarEvents, refreshGoogleToken } from "@/lib/google-calendar";
import { decryptToken, encryptToken } from "@/lib/token-utils";

/**
 * GET /api/google-calendar/events?timeMin=...&timeMax=...
 *
 * Fetches the authenticated user's Google Calendar events for a date range.
 * Automatically refreshes expired access tokens.
 *
 * Query params:
 *   timeMin - ISO date string (defaults to start of current month)
 *   timeMax - ISO date string (defaults to end of current month)
 *
 * Returns: { events: Array<{ id, title, start, end, source }>, connected: boolean }
 */
export async function GET(request) {
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
        "google_calendar_access_token, google_calendar_refresh_token, google_calendar_token_expires_at"
      )
      .eq("id", user.id)
      .single();

    if (!profile?.google_calendar_refresh_token) {
      return NextResponse.json({ events: [], connected: false });
    }

    // Parse date range from query params
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const timeMin =
      searchParams.get("timeMin") ||
      new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const timeMax =
      searchParams.get("timeMax") ||
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    // Decrypt and check token freshness
    let accessToken = decryptToken(profile.google_calendar_access_token);
    const expiresAt = profile.google_calendar_token_expires_at
      ? new Date(profile.google_calendar_token_expires_at)
      : null;

    // Refresh if expired or expiring within 5 minutes
    if (!expiresAt || new Date() > new Date(expiresAt.getTime() - 5 * 60 * 1000)) {
      try {
        const refreshToken = decryptToken(profile.google_calendar_refresh_token);
        const refreshed = await refreshGoogleToken(refreshToken);
        accessToken = refreshed.access_token;

        // Store the new access token
        await admin
          .from("users")
          .update({
            google_calendar_access_token: encryptToken(refreshed.access_token),
            google_calendar_token_expires_at: new Date(refreshed.expiry_date).toISOString(),
          })
          .eq("id", user.id);
      } catch (refreshErr) {
        console.error("Failed to refresh Google Calendar token:", refreshErr.message);
        return NextResponse.json(
          { events: [], connected: true, error: "token_expired" },
          { status: 200 }
        );
      }
    }

    const events = await fetchCalendarEvents(accessToken, timeMin, timeMax);
    return NextResponse.json({ events, connected: true });
  } catch (err) {
    console.error("Google Calendar events error:", err);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
