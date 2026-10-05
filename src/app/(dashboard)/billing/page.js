"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import {
  Loader2,
  Check,
  CreditCard,
  Zap,
  Star,
  ExternalLink,
  MessageSquare,
  BarChart3,
  Headphones,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  getDmLimit,
  getPlanDisplay,
  PLAN_IDS,
  PLAN_CATALOG,
  formatPlanPrice,
  planButtonLabel,
} from "@/lib/plans";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { billingPageView } from "@/lib/billing/managed";

// Plans come from the one catalog (src/lib/plans.js); price ids stay on the
// server. No local copy of prices here.
const PLANS = PLAN_IDS.map((id) => {
  const p = PLAN_CATALOG[id];
  return {
    id,
    name: p.displayName,
    price: formatPlanPrice(p.priceCents),
    period: "/mo",
    dmLimit: p.dmLimitLabel,
    features: p.features,
    popular: p.popular,
  };
});

export default function BillingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  // User-visible billing error. Either checkout (Stripe Checkout link
  // returned nothing / threw) or portal (manage-subscription link did the
  // same). Cleared the next time the user clicks either button.
  const [billingError, setBillingError] = useState(null);
  // Each plan's offer line ("7-day free trial...", "charged today", ...),
  // decided on the server exactly as Checkout will (checkout-offer API).
  const [offerLines, setOfferLines] = useState(null);
  // The server's access decision (kind: stripe | comped | legacy_trial |
  // none). Awaited before first render so a comped account never flashes
  // plan buttons.
  const [access, setAccess] = useState(null);

  useEffect(() => {
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      const { data: userProfile } = await supabase
        .from("users")
        .select(
          "plan, subscription_status, stripe_customer_id, stripe_subscription_id, dm_count_this_month, trial_ends_at, cancel_at"
        )
        .eq("id", authUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
      }

      fetch("/api/billing/checkout-offer")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setOfferLines(data?.lines || null))
        .catch(() => {});

      const accessData = await fetch("/api/billing/access")
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      setAccess(accessData);

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubscribe = async (planId) => {
    setCheckoutLoading(planId);
    setBillingError(null);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, returnTo: "billing" }),
      });

      const data = await res.json().catch(() => ({}));

      if (data.url) {
        posthog.capture("checkout_started", { plan_id: planId });
        window.location.assign(data.url);
        // Leave the spinner up — we're navigating away. If something else
        // goes wrong below, the finally block resets it.
        return;
      }

      // No URL = server didn't return a Checkout session. Surface it.
      setBillingError(
        `Couldn't start checkout. Try again, or contact ${SUPPORT_EMAIL}.`
      );
      setCheckoutLoading(null);
    } catch (err) {
      console.error("Error creating checkout:", err);
      setBillingError(
        `Couldn't start checkout. Try again, or contact ${SUPPORT_EMAIL}.`
      );
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/stripe/create-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json().catch(() => ({}));

      if (data.url) {
        posthog.capture("subscription_portal_opened");
        window.location.assign(data.url);
        return;
      }

      setBillingError(
        `Couldn't open the billing portal. Try again, or contact ${SUPPORT_EMAIL}.`
      );
      setPortalLoading(false);
    } catch (err) {
      console.error("Error creating portal:", err);
      setBillingError(
        `Couldn't open the billing portal. Try again, or contact ${SUPPORT_EMAIL}.`
      );
      setPortalLoading(false);
    }
  };

  const currentPlan = profile?.plan || "free";
  const dmCount = profile?.dm_count_this_month || 0;
  const dmLimit = getDmLimit(currentPlan);
  const isUnlimited = getDmLimit(currentPlan) === Infinity;
  const usagePercent = isUnlimited
    ? 0
    : Math.min((dmCount / dmLimit) * 100, 100);
  const subscriptionStatus = profile?.subscription_status || "inactive";

  const statusVariant =
    subscriptionStatus === "active"
      ? "success"
      : subscriptionStatus === "trialing"
      ? "warning"
      : "muted";

  const planDisplay = getPlanDisplay(currentPlan);
  // A Stripe subscription in any serving status (including a card-required
  // trial), or a comped account. A legacy no-card trial is 'trialing'
  // without a subscription and should still see Subscribe.
  const hasLivePlan =
    subscriptionStatus === "active" ||
    (!!profile?.stripe_subscription_id && ["trialing", "past_due"].includes(subscriptionStatus));
  const planDisplayName = planDisplay.name;
  // Comped (and future managed) accounts: no price, portal or plan buttons
  // (src/lib/billing/managed.js).
  const view = billingPageView({ access, hasStripeCustomer: !!profile?.stripe_customer_id });
  const planPrice =
    currentPlan === "free"
      ? planDisplay.price
      : `${planDisplay.price}${planDisplay.period}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and track usage.
        </p>
      </div>

      {subscriptionStatus === "past_due" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Your last payment didn&apos;t go through. Use{" "}
          <span className="font-semibold">Manage Subscription</span> below to update your card
          and keep your AI replying. Questions? Email{" "}
          <a href={SUPPORT_MAILTO} className="font-semibold underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </div>
      )}

      {billingError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
          <span className="flex-1">{billingError}</span>
          <button
            type="button"
            onClick={() => setBillingError(null)}
            className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
      )}

      {/* Current Plan & Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Plan Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <Badge variant={view.managed ? "success" : statusVariant}>
                {view.managed
                  ? "Complimentary"
                  : subscriptionStatus === "active"
                  ? "Active"
                  : subscriptionStatus === "trialing"
                  ? "Trial"
                  : subscriptionStatus === "past_due"
                  ? "Past Due"
                  : subscriptionStatus === "canceled"
                  ? "Canceled"
                  : "Inactive"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {view.managed ? (
              <>
                <p className="text-3xl font-bold">Complimentary plan</p>
                <p className="text-sm text-muted-foreground">{planDisplayName}</p>
                <p className="text-sm text-muted-foreground">
                  Nothing to pay. Questions? Email{" "}
                  <a href={SUPPORT_MAILTO} className="font-semibold underline">
                    {SUPPORT_EMAIL}
                  </a>
                  .
                </p>
              </>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{planPrice}</span>
                  {currentPlan !== "free" && (
                    <span className="text-sm text-muted-foreground">
                      billed monthly
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{planDisplayName}</p>
              </>
            )}
            {/* Pending cancellation (users.cancel_at, written by the
                customer.subscription.updated webhook). Status stays
                'active' until this date, so without it the plan looked
                like it would renew. */}
            {profile?.cancel_at && subscriptionStatus !== "canceled" && (
              <p className="text-sm font-medium text-amber-700">
                Your plan ends{" "}
                {new Date(profile.cancel_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </p>
            )}
          </CardContent>
          {view.showPortal && (
            <CardFooter>
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Manage Subscription
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Usage Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{dmCount}</span>
              <span className="text-sm text-muted-foreground">
                {isUnlimited
                  ? "conversations (Unlimited)"
                  : `of ${dmLimit.toLocaleString()} conversations used`}
              </span>
            </div>
            {!isUnlimited && (
              <>
                <Progress value={usagePercent} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  {dmLimit - dmCount > 0
                    ? `${(dmLimit - dmCount).toLocaleString()} conversations remaining this month`
                    : `You've hit your monthly cap of ${dmLimit.toLocaleString()} conversations. Existing conversations continue — upgrade to Unlimited to handle new ones.`}
                </p>
                {usagePercent >= 90 && dmLimit - dmCount > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    You&apos;re at {dmCount.toLocaleString()} / {dmLimit.toLocaleString()} conversations.
                    To make sure no leads slip, upgrade to Unlimited now.
                  </p>
                )}
                {usagePercent >= 75 && usagePercent < 90 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    You&apos;ve used {dmCount.toLocaleString()} of {dmLimit.toLocaleString()} conversations
                    this cycle. Upgrade to Unlimited if you&apos;d like to remove the cap.
                  </p>
                )}
              </>
            )}
            {isUnlimited && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-primary" />
                Unlimited conversations with your current plan
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {view.showPlanButtons && (
      <>
      <Separator />

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan = hasLivePlan && currentPlan === plan.id;
            // Same decision create-checkout makes, from the server. Null for
            // live subscribers (they're sent to the portal instead).
            const chargeNote = offerLines?.[plan.id] || null;
            return (
              <Card
                key={plan.id}
                className={`relative ${
                  plan.popular ? "border-primary shadow-md" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className={plan.popular ? "pt-8" : ""}>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>{plan.dmLimit}</CardDescription>
                  <div className="flex items-baseline gap-1 pt-2">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  {isCurrentPlan ? (
                    <Button disabled className="w-full" variant="outline">
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={checkoutLoading === plan.id}
                    >
                      {checkoutLoading === plan.id && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {planButtonLabel({ currentPlanId: currentPlan, hasLivePlan, targetPlanId: plan.id })}
                    </Button>
                  )}
                  {!isCurrentPlan && chargeNote && (
                    <p className="text-xs text-muted-foreground text-center">
                      {chargeNote}
                    </p>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
