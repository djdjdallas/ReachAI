import Link from "next/link";
import { Check, CheckCircle, ShieldCheck } from "lucide-react";

const basePlan = {
  name: "Base",
  price: "$97",
  description: "Ideal for emerging coaches and boutique agencies.",
  features: [
    "500 DMs / month",
    "Basic AI automation",
    "Lead qualification",
    "Auto-book calls",
    "Email support",
  ],
};

const unlimitedPlan = {
  name: "Unlimited",
  price: "$197",
  description: "For high-volume outreach and rapid scale.",
  features: [
    "Unlimited DMs / month",
    "Everything in Base",
    "Advanced Analytics",
    "Priority Support",
    "Custom Personality",
  ],
};

export default function Pricing() {
  return (
    <section id="pricing" className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-24 reveal-up">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-stone-900">
            Simple, performance pricing.
          </h2>
          <p className="text-stone-500 text-xl font-medium">
            Choose the plan that fits your growth.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-start">
          {/* Base Plan */}
          <div className="bg-[#fafaf9] border border-stone-100 rounded-[2.5rem] p-12 flex flex-col reveal-up">
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-4 text-stone-900">
                {basePlan.name}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tight text-stone-900">
                  {basePlan.price}
                </span>
                <span className="text-stone-400 font-bold text-lg">/mo</span>
              </div>
              <p className="mt-6 text-stone-500 font-medium">
                {basePlan.description}
              </p>
            </div>
            <ul className="space-y-4 mb-10 flex-1">
              {basePlan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-3 font-bold text-stone-600"
                >
                  <Check className="w-5 h-5 text-[#ff7e67]" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="text-center">
              <Link
                href="/signup"
                className="w-full block py-4 rounded-full border-2 border-stone-200 font-black hover:border-stone-900 transition-colors text-stone-900 mb-3"
              >
                Start 7-Day Trial
              </Link>
              <p className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">
                Includes 7-day free trial
              </p>
            </div>
          </div>

          {/* Unlimited Plan */}
          <div className="bg-[#ff7e67] text-white rounded-[2.5rem] p-12 flex flex-col relative shadow-2xl shadow-[#ff7e67]/30 reveal-up">
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-stone-900 text-white text-[11px] font-black uppercase tracking-[0.2em] px-5 py-2 rounded-full">
              MOST POPULAR
            </div>
            <div className="mb-10">
              <h3 className="text-xl font-bold mb-4">{unlimitedPlan.name}</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black tracking-tight">
                  {unlimitedPlan.price}
                </span>
                <span className="text-white/60 font-bold text-lg">/mo</span>
              </div>
              <p className="mt-6 text-white/80 font-medium">
                {unlimitedPlan.description}
              </p>
            </div>
            <ul className="space-y-4 mb-10 flex-1 font-bold">
              {unlimitedPlan.features.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="text-center">
              <Link
                href="/signup"
                className="w-full block py-5 rounded-full bg-white text-[#ff7e67] font-black hover:scale-105 active:scale-95 transition-all shadow-xl mb-3"
              >
                Get Unlimited Access
              </Link>
              <p className="text-[11px] text-white/70 font-bold uppercase tracking-wider">
                Includes 7-day free trial
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center gap-4 reveal-up">
          <div className="flex items-center gap-3 px-6 py-3 bg-stone-50 rounded-2xl border border-stone-100">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            <span className="text-sm font-bold text-stone-600">
              14-Day 100% Money-Back Guarantee
            </span>
          </div>
          <p className="text-stone-400 font-medium text-sm">
            No commitment. Cancel anytime with one click.
          </p>
        </div>
      </div>
    </section>
  );
}
