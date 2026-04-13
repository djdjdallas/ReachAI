import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/notifications
 *
 * Fetch the 20 most recent in-app notifications for the authenticated user.
 * Returns: { notifications: [...], unread_count: number }
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

    const { data, error } = await supabase
      .from("email_events")
      .select("id, event_type, metadata, sent_at, read_at")
      .in("event_type", ["hot_lead_alert", "booking_alert"])
      .order("sent_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching notifications:", error);
      return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
    }

    const notifications = data || [];
    const unread_count = notifications.filter((n) => !n.read_at).length;

    return NextResponse.json({ notifications, unread_count });
  } catch (err) {
    console.error("Notifications GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark notifications as read.
 * Body: { all: true } to mark all, or { ids: ["uuid", ...] } for specific ones.
 */
export async function PATCH(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();

    if (body.all) {
      await admin
        .from("email_events")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .is("read_at", null)
        .in("event_type", ["hot_lead_alert", "booking_alert"]);
    } else if (body.ids?.length) {
      await admin
        .from("email_events")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .in("id", body.ids);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
