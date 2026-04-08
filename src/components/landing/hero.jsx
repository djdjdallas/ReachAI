"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import gsap from "gsap";

export default function Hero() {
  const sectionRef = useRef(null);
  const headlineRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);
  const mockupRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(headlineRef.current, {
        y: 40,
        opacity: 0,
        duration: 0.8,
      })
        .from(
          subtitleRef.current,
          { y: 30, opacity: 0, duration: 0.6 },
          "-=0.3"
        )
        .from(
          ctaRef.current,
          { y: 20, opacity: 0, duration: 0.5 },
          "-=0.2"
        )
        .from(
          mockupRef.current,
          { y: 60, opacity: 0, duration: 0.9, ease: "power2.out" },
          "-=0.3"
        );

    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative pt-24 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-white"
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#fff5f2] to-transparent rounded-full blur-3xl -z-10 opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-8 shadow-sm border border-[#ff7e67]/10">
          <Sparkles className="w-4 h-4" />
          The AI Setter Built for Coaches
        </div>

        <h1
          ref={headlineRef}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-stone-900 max-w-6xl mx-auto mb-10 leading-[1.05]"
        >
          Book More Discovery Calls{" "}
          <span className="text-[#ff7e67] relative inline-block">
            While You Sleep.
            <span className="absolute bottom-1 left-0 w-full h-3 bg-[#ff7e67]/10 -z-10" />
          </span>
        </h1>

        <p
          ref={subtitleRef}
          className="text-lg md:text-2xl text-stone-500 max-w-3xl mx-auto mb-12 leading-relaxed font-medium"
        >
          Clinchd is an AI setter that qualifies every DM, handles objections,
          and drops your Calendly link at the right moment — so you wake up to
          booked calls, not missed leads.
        </p>

        <div ref={ctaRef} className="flex flex-col items-center gap-5">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-10 py-5 bg-[#ff7e67] text-white rounded-full text-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#ff7e67]/30 flex items-center justify-center gap-3 group"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-10 py-5 bg-white text-stone-900 rounded-full text-xl font-bold border-2 border-stone-200 hover:border-stone-900 transition-all flex items-center justify-center"
            >
              See How It Works
            </a>
          </div>
          <p className="text-sm text-stone-400 font-medium">
            No credit card required &middot; $97/mo after &middot; Cancel
            anytime
          </p>
          <div className="flex items-center gap-2 mt-2 px-5 py-2.5 bg-stone-50 rounded-2xl border border-stone-100">
            <span className="text-sm font-bold text-stone-600">
              Used by 100+ coaches and course creators
            </span>
          </div>
        </div>

        {/* Hero Demo Video */}
        <div ref={mockupRef} className="mt-24 md:mt-32 relative max-w-5xl mx-auto">
          <div className="absolute -inset-10 bg-[#ff7e67]/5 blur-[120px] rounded-full -z-10" />
          <div className="relative bg-white border border-stone-100 rounded-[2.5rem] p-3 md:p-4 soft-shadow overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-[2rem] border border-stone-100"
            >
              <source src="/animations/01-hero-demo.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
