import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { decideCheckoutTrial } from "@/lib/billing/trial-policy";
import { offerText } from "@/lib/checkout-trial";
import { PLAN_IDS, PLAN_CATALOG } from "@/lib/plans";

export const dynamic = "force-dynamic";

// GET /api/billing/checkout-offer: the line each plan card shows ("7-day
// free trial...", "charged today", or a legacy trial's remaining days),
// from the SAME server decision /api/stripe/create-checkout makes. UI only.
// Returns lines: null for a customer with a live subscription (they go to
// the Customer Portal instead of Checkout).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const admin = getSupabaseAdmin();
    const { data: row, error } = await admin
      .from("users")
      .select("email, subscription_status, trial_ends_at, stripe_subscription_id")
      .eq("id", user.id)
      .single();
    if (error || !row) throw error || new Error("no profile");

    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(admin, user);
    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    if (subs.data.some((s) => !["canceled", "incomplete_expired"].includes(s.status))) {
      return NextResponse.json({ mode: "portal", lines: null });
    }

    const offer = await decideCheckoutTrial({
      user: { ...row, email: row.email || user.email },
      customerId,
      stripe,
      admin,
    });
    const lines = Object.fromEntries(
      PLAN_IDS.map((id) => [id, offerText(offer, PLAN_CATALOG[id].priceCents)])
    );
    return NextResponse.json({ mode: offer.mode, lines });
  } catch (err) {
    console.error("[checkout-offer] failed:", err?.message);
    return NextResponse.json({ error: "offer_unavailable" }, { status: 500 });
  }
}
