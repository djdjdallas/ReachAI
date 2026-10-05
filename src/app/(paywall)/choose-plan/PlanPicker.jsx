"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import posthog from "posthog-js";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

// Plan cards. Sends only the plan id; the server validates it against PLANS
// and picks the price and trial (never anything from the browser).
export default function PlanPicker({ heading, subheading, plans, missedLeadsLine }) {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  const choose = async (planId) => {
    setError(null);
    setLoadingPlan(planId);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, returnTo: "choose-plan" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "checkout_failed");
      posthog.capture("checkout_started", { plan_id: planId, source: "choose_plan" });
      window.location.href = data.url;
    } catch {
      setError("Couldn't open checkout. Try again, or email us.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="pt-6">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">{heading}</h1>
        <p className="text-stone-600 leading-relaxed">{subheading}</p>
        {missedLeadsLine && (
          <p className="mt-5 inline-block rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {missedLeadsLine}
          </p>
        )}
      </div>

      {error && (
        <p className="max-w-xl mx-auto mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 text-center">
          {error}{" "}
          <a href={SUPPORT_MAILTO} className="font-bold underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-3xl border bg-white p-7 ${
              plan.popular ? "border-[#ff7e67] shadow-xl shadow-[#ff7e67]/10" : "border-stone-200"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-3 left-7 rounded-full bg-[#ff7e67] px-3 py-1 text-xs font-bold text-white">
                Most popular
              </span>
            )}
            <h2 className="text-xl font-black">{plan.name}</h2>
            <p className="mt-1 text-sm text-stone-500">{plan.dmLimitLabel}</p>
            <p className="mt-5">
              <span className="text-4xl font-black">{plan.price}</span>
              <span className="text-stone-500 font-bold">/mo</span>
            </p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-stone-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ff7e67]" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => choose(plan.id)}
              disabled={loadingPlan !== null}
              className={`mt-7 w-full rounded-2xl py-4 font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2 ${
                plan.popular ? "bg-[#ff7e67] text-white hover:bg-[#ff6a50]" : "bg-stone-900 text-white hover:bg-stone-800"
              }`}
            >
              {loadingPlan === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
              Choose {plan.name}
            </button>
            <p className="mt-3 text-center text-xs text-stone-500">{plan.offerLine}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
