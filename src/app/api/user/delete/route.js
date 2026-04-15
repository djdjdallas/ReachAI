import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function DELETE() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = user.id;
  const admin = getSupabaseAdmin();

  try {
    // 1. Cancel Stripe subscription if one exists
    const { data: profile } = await admin
      .from("users")
      .select(
        "stripe_subscription_id, meta_page_access_token, instagram_business_account_id"
      )
      .eq("id", userId)
      .single();

    if (profile?.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
      } catch (err) {
        // Already cancelled / not found — safe to ignore and continue with deletion
        if (err?.code !== "resource_missing") {
          console.error("[delete-account] stripe cancel failed:", err);
        }
      }
    }

    // 2. Delete messages for all conversations owned by this user
    const { data: convos, error: convosSelectErr } = await admin
      .from("conversations")
      .select("id")
      .eq("user_id", userId);

    if (convosSelectErr) throw convosSelectErr;

    const conversationIds = (convos ?? []).map((c) => c.id);

    if (conversationIds.length > 0) {
      const { error: msgErr } = await admin
        .from("messages")
        .delete()
        .in("conversation_id", conversationIds);
      if (msgErr) throw msgErr;
    }

    // 3. Delete conversations
    const { error: convoErr } = await admin
      .from("conversations")
      .delete()
      .eq("user_id", userId);
    if (convoErr) throw convoErr;

    // 4. Delete bookings
    const { error: bookingErr } = await admin
      .from("bookings")
      .delete()
      .eq("user_id", userId);
    if (bookingErr) throw bookingErr;

    // 5. Delete users row
    const { error: userErr } = await admin
      .from("users")
      .delete()
      .eq("id", userId);
    if (userErr) throw userErr;

    // 6. Unsubscribe Instagram webhooks so Meta stops firing events at us
    if (
      profile?.meta_page_access_token &&
      profile?.instagram_business_account_id
    ) {
      try {
        const url = `https://graph.instagram.com/v21.0/${profile.instagram_business_account_id}/subscribed_apps?access_token=${encodeURIComponent(profile.meta_page_access_token)}`;
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn(
            "[delete-account] meta unsubscribe non-ok:",
            res.status,
            body
          );
        }
      } catch (err) {
        console.warn("[delete-account] meta unsubscribe failed:", err?.message);
      }
    }

    // 7. Delete auth.users row via admin API
    const { error: authErr } = await admin.auth.admin.deleteUser(userId);
    if (authErr) throw authErr;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-account] failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
