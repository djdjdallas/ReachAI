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
import { getDmLimit, getPlanDisplay } from "@/lib/plans";

const PLANS = [
  {
    id: "base",
    name: "Base Plan",
    price: "$97",
    period: "/mo",
    dmLimit: "1,500 qualified conversations/month",
    features: [
      "1,500 AI-assisted qualified conversations per month",
      "AI-assisted lead qualification",
      "Calendar-connected call booking",
      "Script builder with AI generation",
      "Conversation dashboard",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "unlimited",
    name: "Unlimited Plan",
    price: "$197",
    period: "/mo",
    dmLimit: "Unlimited conversations",
    features: [
      "Unlimited AI-assisted conversations",
      "AI-assisted lead qualification",
      "Calendar-connected call booking",
      "Script builder with AI generation",
      "Conversation dashboard",
      "Advanced analytics & reporting",
      "Priority support",
      "Custom AI personality tuning",
      "Comment-to-DM with AI intent grading",
    ],
    popular: true,
  },
];

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
          "plan, subscription_status, stripe_customer_id, dm_count_this_month"
        )
        .eq("id", authUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
      }

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
        body: JSON.stringify({ planId }),
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
        "Couldn't start checkout. Try again, or contact support@clinchd.io."
      );
      setCheckoutLoading(null);
    } catch (err) {
      console.error("Error creating checkout:", err);
      setBillingError(
        "Couldn't start checkout. Try again, or contact support@clinchd.io."
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
        "Couldn't open the billing portal. Try again, or contact support@clinchd.io."
      );
      setPortalLoading(false);
    } catch (err) {
      console.error("Error creating portal:", err);
      setBillingError(
        "Couldn't open the billing portal. Try again, or contact support@clinchd.io."
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
  const planDisplayName = planDisplay.name;
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
              <Badge variant={statusVariant}>
                {subscriptionStatus === "active"
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
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{planPrice}</span>
              {currentPlan !== "free" && (
                <span className="text-sm text-muted-foreground">
                  billed monthly
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{planDisplayName}</p>
          </CardContent>
          {profile?.stripe_customer_id && (
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

      <Separator />

      {/* Plan Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.map((plan) => {
            const isCurrentPlan =
              currentPlan === plan.id &&
              subscriptionStatus === "active";
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
                <CardFooter>
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
                      {currentPlan !== "free" && !isCurrentPlan
                        ? "Upgrade"
                        : "Subscribe"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
