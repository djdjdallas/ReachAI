"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Check, CheckCircle, ShieldCheck } from "lucide-react";
import posthog from "posthog-js";

const basePlan = {
  name: "Base",
  price: "$97",
  description: "For coaches ready to stop losing leads in their DMs.",
  features: [
    "1,500 qualified conversations / month",
    "AI setter replies in your voice",
    "Lead qualification",
    "Auto-book discovery calls",
    "Email support",
  ],
};

const unlimitedPlan = {
  name: "Unlimited",
  price: "$197",
  description: "For coaches who want their real voice on the replies that fit.",
  features: [
    "Unlimited conversations / month",
    "Comment-to-DM with AI intent grading. Only high-intent commenters reach your inbox",
    "Everything in Base",
    "Voice replies in your own recorded audio",
    "Advanced analytics",
    "Priority support",
    "Custom AI personality tuning",
  ],
};

export default function Pricing() {
  const sectionRef = useRef(null);
  const hasTracked = useRef(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTracked.current) {
          hasTracked.current = true;
          posthog.capture("pricing_section_viewed");
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="pricing" className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-24 reveal-up">
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-stone-900">
            A $3,000 setter, or $97/mo.
          </h2>
          <p className="text-stone-500 text-xl font-medium">
            The price is on this page because you shouldn&apos;t have to book a call to learn it.
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
                onClick={() => posthog.capture("pricing_cta_clicked", { plan: "base", price: "$97" })}
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
                onClick={() => posthog.capture("pricing_cta_clicked", { plan: "unlimited", price: "$197" })}
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

        {/* Transparent, flat-rate wedge — anchored to the setter cost, no competitor names */}
        <div className="mt-20 max-w-4xl mx-auto reveal-up">
          <div className="rounded-[2rem] bg-stone-900 text-white p-10 md:p-14 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-72 h-72 bg-[#ff7e67]/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#ff7e67] mb-4">
                What it costs. Really.
              </div>
              <h3 className="text-2xl md:text-4xl font-black mb-6 leading-tight tracking-tight">
                You shouldn&apos;t need a sales call to learn the price.
              </h3>
              <p className="text-white/80 text-lg font-medium leading-relaxed mb-8 max-w-2xl">
                A human setter runs $2,000 to $4,000 a month. The done-for-you build
                teams hide their number behind an application and a call. Clinchd
                puts it right here, and your viral Reel never becomes a billing event.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                    A human setter
                  </div>
                  <div className="text-2xl font-black mb-1">$2k to $4k/mo</div>
                  <div className="text-xs text-white/60">+ sleeps, ramps, has off days</div>
                </div>
                <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2">
                    Done-for-you build teams
                  </div>
                  <div className="text-2xl font-black mb-1">Price on a call</div>
                  <div className="text-xs text-white/60">+ application and a 72 hour build</div>
                </div>
                <div className="bg-[#ff7e67] rounded-2xl p-5 border border-[#ff7e67]">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/80 mb-2">
                    Clinchd Unlimited
                  </div>
                  <div className="text-2xl font-black mb-1">$197/mo. Flat.</div>
                  <div className="text-xs text-white/90">1,500 conversations or 50,000. Same bill.</div>
                </div>
              </div>
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
