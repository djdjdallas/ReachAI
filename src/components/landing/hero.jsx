"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import DMConversation from "@/components/landing/animations/DMConversation";

/**
 * Hero — Clinchd homepage hero with split layout
 *
 * STRUCTURE:
 * - Left (~55%): Badge + headline + subtitle + CTAs + trust microcopy
 * - Right (~45%): QualifyDM live animation
 * - Mobile: stacks vertically (text first, then animation)
 *
 * REPLACES: the previous hero.jsx that used a single full-width video below
 * the centered headline.
 *
 * GSAP entry timeline mirrors the original — only difference: the animation
 * column slides in from the right (`x: 30`) instead of rising from below
 * (`y: 60`), which feels more natural for a side-content layout.
 */

export default function Hero() {
  const sectionRef = useRef(null);
  const badgeRef = useRef(null);
  const headlineRef = useRef(null);
  const subtitleRef = useRef(null);
  const ctaRef = useRef(null);
  const trustRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(badgeRef.current, {
        y: 20,
        opacity: 0,
        duration: 0.6,
      })
        .from(
          headlineRef.current,
          { y: 40, opacity: 0, duration: 0.8 },
          "-=0.3"
        )
        .from(
          subtitleRef.current,
          { y: 30, opacity: 0, duration: 0.6 },
          "-=0.4"
        )
        .from(ctaRef.current, { y: 20, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(
          trustRef.current,
          { y: 15, opacity: 0, duration: 0.5 },
          "-=0.3"
        )
        .from(
          animRef.current,
          { x: 30, opacity: 0, duration: 0.9, ease: "power2.out" },
          "-=0.6"
        );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative pt-20 pb-20 md:pt-32 md:pb-28 overflow-hidden bg-white"
    >
      {/* Background coral wash */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-[#fff5f2] to-transparent rounded-full blur-3xl -z-10 opacity-60" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* ─── LEFT: TEXT COLUMN ─── */}
          <div className="w-full lg:w-[55%]">
            {/* Pre-headline badge */}
            <div
              ref={badgeRef}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#fff5f2] border border-[#ff7e67]/15 mb-6 shadow-sm"
            >
              <span className="relative block w-1.5 h-1.5 rounded-full bg-[#ff7e67]">
                <span className="absolute -inset-1 rounded-full bg-[#ff7e67] opacity-40 animate-ping" />
              </span>
              <span className="text-[13px] font-bold text-[#ff7e67] tracking-tight">
                The DM setter you don&apos;t have to apply for
              </span>
            </div>

            {/* Headline */}
            <h1
              ref={headlineRef}
              className="text-stone-900 leading-[1.05] mb-6"
              style={{
                fontSize: "clamp(2.75rem, 5.5vw, 4.5rem)",
                fontWeight: 900,
                letterSpacing: "-0.035em",
              }}
            >
              A DM setter that&apos;s live today.{" "}
              <span className="relative inline-block">
                <span className="text-[#ff7e67] relative z-10">
                  No application required.
                </span>
                <span className="absolute bottom-2 left-0 w-full h-[0.4em] bg-[#ff7e67]/12 -z-0" />
              </span>
            </h1>

            {/* Subtitle */}
            <p
              ref={subtitleRef}
              className="text-stone-600 text-base md:text-lg lg:text-xl leading-relaxed font-medium mb-8 max-w-xl"
            >
              Clinchd qualifies every conversation, handles the usual
              objections, and books calls in your tone, 24/7. Pick a plan,
              connect Instagram, go live in minutes. No $3,000 setter, no
              qualifying call, no waiting on a build team.
            </p>

            {/* CTAs */}
            <div ref={ctaRef} className="flex flex-wrap gap-3 mb-5">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-7 py-4 bg-[#ff7e67] text-white rounded-full text-[15px] font-bold tracking-tight shadow-[0_4px_14px_rgba(255,126,103,0.35)] hover:shadow-[0_6px_20px_rgba(255,126,103,0.45)] hover:-translate-y-px transition-all"
              >
                Start for $97/month
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-7 py-4 bg-white text-stone-900 border border-stone-200 hover:border-stone-300 hover:bg-stone-50 rounded-full text-[15px] font-bold tracking-tight transition-all"
              >
                See How It Works
              </Link>
            </div>

            {/* Trust microcopy */}
            <p className="text-[13px] font-medium text-stone-500 tracking-tight mb-7">
              No application · No sales call · Live in minutes
            </p>

            {/* Social proof strip */}
            <div
              ref={trustRef}
              className="flex items-center gap-3 pt-5 border-t border-stone-100 max-w-md"
            >
              {/* Avatar stack — replace initials with real user photos when available */}
              <div className="flex">
                {[
                  { bg: "#fcefe8", letter: "S" },
                  { bg: "#ffe0d4", letter: "M" },
                  { bg: "#ffd4c2", letter: "J" },
                  { bg: "#ffcab6", letter: "E" },
                ].map((avatar, i) => (
                  <div
                    key={i}
                    className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#ff7e67]"
                    style={{
                      background: avatar.bg,
                      marginLeft: i === 0 ? 0 : "-8px",
                    }}
                  >
                    {avatar.letter}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-stone-900 leading-snug">
                  Used by coaches and course creators
                </div>
                <div className="text-[11px] font-medium text-stone-400 mt-px">
                  ★★★★★ from early users
                </div>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: DM CONVERSATION ANIMATION ─── */}
          <div
            ref={animRef}
            className="w-full lg:flex-1 lg:max-w-[480px] relative"
          >
            {/* Soft coral glow behind the demo card */}
            <div className="absolute -inset-8 bg-[#ff7e67]/5 blur-3xl rounded-full -z-10" />
            <DMConversation />
          </div>
        </div>
      </div>
    </section>
  );
}
