"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, CheckCircle } from "lucide-react";
import gsap from "gsap";

export default function Hero() {
  const sectionRef = useRef(null);
  const headlineRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);
  const mockupRef = useRef(null);
  const floatingBubbleRef = useRef(null);

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

      // Floating chat bubble
      if (floatingBubbleRef.current) {
        gsap.to(floatingBubbleRef.current, {
          y: -10,
          repeat: -1,
          yoyo: true,
          duration: 1.5,
          ease: "power1.inOut",
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative pt-24 pb-20 md:pt-40 md:pb-32 overflow-hidden bg-white"
    >
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#fff5f2] to-transparent rounded-full blur-3xl -z-10 opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-8 shadow-sm border border-[#ff7e67]/10">
          <Sparkles className="w-4 h-4" />
          The #1 AI Agent for Instagram
        </div>

        {/* Headline */}
        <h1
          ref={headlineRef}
          className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-stone-900 max-w-6xl mx-auto mb-10 leading-[1.05]"
        >
          Your Instagram DMs Are Full of{" "}
          <span className="text-[#ff7e67] relative inline-block">
            Money
            <span className="absolute bottom-1 left-0 w-full h-3 bg-[#ff7e67]/10 -z-10" />
          </span>{" "}
          You&apos;re Leaving Behind.
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className="text-lg md:text-2xl text-stone-500 max-w-3xl mx-auto mb-12 leading-relaxed font-medium"
        >
          Clinchd is the first human-like AI sales agent that qualifies leads
          and books calls in your Instagram DMs—while you sleep.
        </p>

        {/* CTA */}
        <div ref={ctaRef} className="flex flex-col items-center gap-5">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-10 py-5 bg-[#ff7e67] text-white rounded-full text-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-[#ff7e67]/30 flex items-center justify-center gap-3 group"
          >
            Start Your 7-Day Free Trial
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-sm text-stone-400 font-medium">
            No credit card required &middot; $97/mo after &middot; Cancel
            anytime
          </p>
        </div>

        {/* DM Mockup */}
        <div ref={mockupRef} className="mt-24 md:mt-32 relative max-w-5xl mx-auto">
          <div className="absolute -inset-10 bg-[#ff7e67]/5 blur-[120px] rounded-full -z-10" />
          <div className="relative bg-white border border-stone-100 rounded-[2.5rem] p-4 soft-shadow overflow-hidden">
            <div className="bg-stone-50 rounded-[2rem] border border-stone-100 overflow-hidden aspect-[16/10] flex">
              {/* Sidebar */}
              <div className="w-1/4 border-r border-stone-200/50 p-6 hidden md:block bg-white">
                <div className="h-4 w-24 bg-stone-100 rounded-full mb-8" />
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-stone-100" />
                    <div className="space-y-2">
                      <div className="h-2.5 w-16 bg-stone-100 rounded-full" />
                      <div className="h-2 w-20 bg-stone-50 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#fff5f2] rounded-2xl border border-[#ff7e67]/10">
                    <div className="w-10 h-10 rounded-full bg-[#ff7e67] flex items-center justify-center text-white font-bold text-xs shadow-md shadow-[#ff7e67]/20">
                      AI
                    </div>
                    <div className="space-y-2">
                      <div className="h-2.5 w-12 bg-[#ff7e67]/20 rounded-full" />
                      <div className="h-2 w-24 bg-[#ff7e67]/10 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-40">
                    <div className="w-10 h-10 rounded-full bg-stone-100" />
                    <div className="space-y-2">
                      <div className="h-2.5 w-20 bg-stone-100 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 bg-[#fafaf9] flex flex-col p-8">
                <div className="flex-1 space-y-6">
                  <div className="flex justify-end">
                    <div className="bg-stone-900 text-white px-5 py-3 rounded-3xl rounded-tr-none max-w-xs text-sm font-medium shadow-lg">
                      How much for your coaching?
                    </div>
                  </div>
                  <div
                    ref={floatingBubbleRef}
                    className="flex justify-start items-end gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#ff7e67] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 mb-1">
                      AI
                    </div>
                    <div className="bg-white border border-stone-100 px-5 py-3 rounded-3xl rounded-tl-none max-w-sm text-sm font-medium text-stone-600 soft-shadow">
                      Hey Sarah! Prices vary based on your goals. Are you
                      currently at $10k/mo or just starting out?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-stone-900 text-white px-5 py-3 rounded-3xl rounded-tr-none max-w-xs text-sm font-medium shadow-lg">
                      Doing around $15k, looking to scale.
                    </div>
                  </div>
                  <div className="flex justify-start items-end gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#ff7e67] flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 mb-1">
                      AI
                    </div>
                    <div className="bg-white border border-stone-100 px-5 py-3 rounded-3xl rounded-tl-none max-w-sm text-sm font-medium text-stone-600 soft-shadow">
                      Perfect. You&apos;re a great fit. Let&apos;s hop on a
                      strategy call:{" "}
                      <span className="text-[#ff7e67] underline">
                        cal.com/book
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                  <CheckCircle className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
                      Status: Qualified
                    </p>
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Booking link delivered automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
