import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { accessDecision } from "@/lib/billing/access";
import { ACCESS_COLUMNS } from "@/lib/billing/status";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { decideCheckoutTrial } from "@/lib/billing/trial-policy";
import { offerText } from "@/lib/checkout-trial";
import { PLAN_IDS, PLAN_CATALOG, formatPlanPrice } from "@/lib/plans";
import { INACTIVE_REASONS, missedLeadsText } from "@/lib/inactive-inbound";
import PlanPicker from "./PlanPicker";
import CheckoutPending from "./CheckoutPending";

export const dynamic = "force-dynamic";

// Plan selection and the paywall. Middleware sends every signed-in user
// without access here. The offer line on each plan is the SAME server
// decision the Checkout route makes (decideCheckoutTrial), so the page and
// Stripe can't disagree. Access is never granted here: after Checkout,
// ?checkout=success only waits for the webhook (CheckoutPending).
export default async function ChoosePlanPage({ searchParams }) {
  const params = (await searchParams) || {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = getSupabaseAdmin();
  const { data: row } = await admin
    .from("users")
    .select(`email, onboarding_completed, ${ACCESS_COLUMNS}`)
    .eq("id", user.id)
    .single();

  const decision = accessDecision(row);
  if (decision.hasAccess) {
    // Routing only (onboarding_completed is never used for access).
    redirect(row?.onboarding_completed ? "/dashboard" : "/onboarding");
  }

  if (params.checkout === "success") {
    return <CheckoutPending />;
  }

  // Every user gets a Stripe customer (email signups included), and the
  // trial decision needs it. On a Stripe error, show "charged today" rather
  // than promise a trial Checkout might not grant.
  let offer = { mode: "none", reason: "unavailable" };
  try {
    const customerId = await ensureStripeCustomer(admin, user);
    offer = await decideCheckoutTrial({
      user: { ...row, email: row?.email || user.email },
      customerId,
      stripe: getStripe(),
      admin,
    });
  } catch (err) {
    console.error("[choose-plan] offer failed:", err?.message);
  }

  // Leads who messaged while there was no access (saved by the webhook).
  let missed = null;
  if (decision.kind !== "none" || row?.subscription_status === "canceled") {
    const { count } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("last_skip_reason", Object.values(INACTIVE_REASONS));
    missed = missedLeadsText(count || 0, row?.subscription_status === "canceled" ? "canceled" : "expired");
  }

  const plans = PLAN_IDS.map((id) => {
    const p = PLAN_CATALOG[id];
    return {
      id,
      name: p.displayName,
      price: formatPlanPrice(p.priceCents),
      dmLimitLabel: p.dmLimitLabel,
      features: p.features,
      popular: p.popular,
      offerLine: offerText(offer, p.priceCents),
    };
  });

  const heading =
    offer.mode === "trial"
      ? "Start your 7-day free trial"
      : decision.reason === "legacy_trial_ended"
        ? "Your free trial has ended"
        : offer.mode === "carry"
          ? "Pick your plan"
          : "Choose a plan to keep going";
  const subheading =
    offer.mode === "trial"
      ? "Pick a plan. You add a card now and won't be charged until your trial ends. Cancel anytime before then."
      : "Your conversations and settings are saved. Pick a plan to turn your AI back on.";

  return <PlanPicker heading={heading} subheading={subheading} plans={plans} missedLeadsLine={missed} />;
}
