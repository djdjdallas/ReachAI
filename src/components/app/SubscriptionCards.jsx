"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, LifeBuoy, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { getPlanDisplay } from "@/lib/plans";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { isManagedAccount } from "@/lib/billing/managed";

// Settings: where coaches find their plan and how to reach us. Display
// only; the access decision and its kind ('stripe' | 'comped' |
// 'legacy_trial' | 'none') come from the server (GET /api/billing/access).
// No portal logic here: "Manage billing" goes to /billing.

const fmt = (v) =>
  v
    ? new Date(v).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

const STATUS_LABEL = {
  active: "Active",
  trialing: "Free trial",
  past_due: "Payment past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

export function subscriptionSummary(profile, access) {
  const plan = getPlanDisplay(profile?.plan).name;
  if (!access) return null;

  if (isManagedAccount(access)) {
    return { title: "Complimentary plan", detail: plan, showManage: false };
  }
  if (access.kind === "legacy_trial") {
    return {
      title: `${plan}, free trial`,
      detail: access.hasAccess
        ? `Your free trial ends ${fmt(profile?.trial_ends_at)}.`
        : "Your free trial has ended.",
      showManage: true,
    };
  }
  if (access.kind === "stripe") {
    const status = profile?.subscription_status;
    let detail = null;
    if (profile?.cancel_at && status !== "canceled") {
      detail = `Cancels on ${fmt(profile.cancel_at)}.`;
    } else if (status === "trialing") {
      detail = `Trial ends ${fmt(profile?.trial_ends_at || profile?.current_period_end)}. Your first charge is on that date.`;
    } else if (status === "active" && profile?.current_period_end) {
      detail = `Next billing date: ${fmt(profile.current_period_end)}.`;
    }
    return {
      title: `${plan}, ${STATUS_LABEL[status] || status}`,
      detail,
      showManage: true,
      pastDue: status === "past_due",
    };
  }
  return { title: "No active plan", detail: "Choose a plan to turn your AI on.", showManage: true, choosePlan: true };
}

export default function SubscriptionCards({ profile }) {
  const [access, setAccess] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/billing/access")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setAccess(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = subscriptionSummary(profile, access);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!summary ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div>
                <p className="text-sm font-semibold">{summary.title}</p>
                {summary.detail && <p className="text-sm text-muted-foreground">{summary.detail}</p>}
              </div>
              {summary.pastDue && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Your last payment didn&apos;t go through. Update your card to keep your AI replying.
                    Questions? Email{" "}
                    <a href={SUPPORT_MAILTO} className="font-semibold underline">
                      {SUPPORT_EMAIL}
                    </a>
                    .
                  </span>
                </div>
              )}
              {summary.showManage && (
                <Link
                  href={summary.choosePlan ? "/choose-plan" : "/billing"}
                  className="inline-block text-sm font-semibold text-[#ff7e67] hover:underline"
                >
                  {summary.choosePlan ? "Choose a plan" : summary.pastDue ? "Update card" : "Manage billing"}
                </Link>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LifeBuoy className="h-5 w-5" />
            Help &amp; support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            Questions? Email{" "}
            <a href={SUPPORT_MAILTO} className="font-semibold text-[#ff7e67] underline">
              {SUPPORT_EMAIL}
            </a>
            . I reply within 24 hours.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
