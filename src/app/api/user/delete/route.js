import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { decryptToken } from "@/lib/token-utils";
import {
  sendBusinessEventAlert,
  accountAgeHours,
} from "@/lib/alerts/business-events";
import { getPostHogClient } from "@/lib/posthog-server";

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
    const { data: profile } = await admin
      .from("users")
      .select(
        "stripe_subscription_id, meta_page_access_token, instagram_business_account_id, email, instagram_username, plan, subscription_status, created_at"
      )
      .eq("id", userId)
      .single();

    // 0. Make the deletion visible BEFORE anything is deleted, while the
    // row is still readable. Both are awaited so a Vercel freeze can't drop
    // them, and neither can block the deletion: sendBusinessEventAlert
    // never throws, and the PostHog capture is wrapped. The client used to
    // capture account_deleted itself, but posthog.reset() and the redirect
    // right after it dropped the event (it never reached PostHog for the
    // 2026-09-25 self-delete).
    const email = profile?.email || user.email || null;
    const ageHours = accountAgeHours(profile?.created_at);
    await sendBusinessEventAlert("account_deleted", {
      email,
      instagramUsername: profile?.instagram_username || null,
      plan: profile?.plan || null,
      subscriptionStatus: profile?.subscription_status || null,
      createdAt: profile?.created_at || null,
      accountAgeHours: ageHours,
    });
    try {
      await getPostHogClient().captureImmediate({
        distinctId: email || userId,
        event: "account_deleted",
        properties: {
          user_id: userId,
          plan: profile?.plan || null,
          subscription_status: profile?.subscription_status || null,
          instagram_connected: !!profile?.instagram_business_account_id,
          account_age_hours: ageHours,
        },
      });
    } catch (err) {
      console.error("[delete-account] posthog capture failed:", err?.message);
    }

    // 1. Cancel Stripe subscription if one exists

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
        // Tokens are encrypted at rest — decrypt before calling Meta.
        // Passing the ciphertext here made every unsubscribe fail
        // silently, orphaning the webhook subscription: Meta kept firing
        // events for the deleted account, which then hit "no user".
        const token = decryptToken(profile.meta_page_access_token);
        const url = `https://graph.instagram.com/v21.0/${profile.instagram_business_account_id}/subscribed_apps?access_token=${encodeURIComponent(token)}`;
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(
            "[delete-account] meta unsubscribe FAILED — webhook subscription may be orphaned:",
            res.status,
            body.slice(0, 200)
          );
        }
      } catch (err) {
        console.error(
          "[delete-account] meta unsubscribe FAILED — webhook subscription may be orphaned:",
          err?.message
        );
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
