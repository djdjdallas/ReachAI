import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  createCheckoutSession,
  createCustomerPortalSession,
  getStripe,
  planForCheckout,
} from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { decideCheckoutTrial } from "@/lib/billing/trial-policy";
import { offerText } from "@/lib/checkout-trial";
import { accessDecision } from "@/lib/billing/access";
import { ACCESS_COLUMNS } from "@/lib/billing/status";
import { isManagedAccount } from "@/lib/billing/managed";
import { SUPPORT_EMAIL } from "@/lib/support";

// Shown when a comped (or other managed) account tries to buy a plan.
export const MANAGED_ACCOUNT_MESSAGE = `Your plan is complimentary, so there's nothing to buy. Questions? Email ${SUPPORT_EMAIL}.`;

// Where Stripe sends the coach back. Allowlisted; never a URL from the
// client. The plan-selection page is the default (new signups, paywall);
// the billing page passes "billing".
const RETURN_PATHS = {
  "choose-plan": { success: "/choose-plan?checkout=success", cancel: "/choose-plan" },
  billing: { success: "/choose-plan?checkout=success", cancel: "/billing" },
};

export async function POST(request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, returnTo } = await request.json().catch(() => ({}));

    // The plan id is validated server-side against PLANS; the price id
    // comes from server config, never from the request.
    const plan = planForCheckout(planId);
    if (!plan?.priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const paths = RETURN_PATHS[returnTo] || RETURN_PATHS["choose-plan"];

    const admin = getSupabaseAdmin();
    const { data: userProfile, error: profileError } = await admin
      .from("users")
      .select(`email, ${ACCESS_COLUMNS}`)
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    }

    // Comped and managed accounts have nothing to buy (src/lib/billing/
    // managed.js). /billing hides the plan buttons for them; this is the
    // server-side rule, so a stale page or a hand-made request can't start
    // a paid Checkout for a comped founder. Checked before any Stripe call.
    if (isManagedAccount(accessDecision(userProfile))) {
      return NextResponse.json(
        { error: "managed_account", message: MANAGED_ACCOUNT_MESSAGE },
        { status: 409 }
      );
    }

    const customerId = await ensureStripeCustomer(admin, user);

    // Never start a second subscription: an active customer clicking
    // Subscribe/Upgrade used to get a brand-new concurrent subscription
    // (double-billed, plus webhook last-event-wins flapping the plan column).
    // Stripe is the source of truth here; DB status can lag webhook delivery.
    const existing = await getStripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const hasLiveSubscription = existing.data.some(
      (s) => !["canceled", "incomplete_expired"].includes(s.status)
    );
    if (hasLiveSubscription) {
      // Same response shape the client already handles: send them to the
      // billing portal, where plan changes modify the existing subscription.
      const portal = await createCustomerPortalSession(customerId);
      return NextResponse.json({ url: portal.url }, { status: 200 });
    }

    // One trial per person (src/lib/billing/trial-policy.js): a 7-day trial
    // for someone new, the remaining days for a legacy trial, otherwise
    // charge today. The plan page shows the same decision before the click.
    const offer = await decideCheckoutTrial({
      user: { ...userProfile, email: userProfile.email || user.email },
      customerId,
      stripe: getStripe(),
      admin,
    });

    const session = await createCheckoutSession(customerId, plan.priceId, user.id, {
      trialPeriodDays: offer.mode === "trial" ? offer.trialPeriodDays : null,
      trialEnd: offer.mode === "carry" ? offer.trialEnd : null,
      submitMessage: offerText(offer, plan.price),
      successPath: paths.success,
      cancelPath: paths.cancel,
    });

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Create checkout error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
