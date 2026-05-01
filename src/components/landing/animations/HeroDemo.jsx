"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * HeroDemo — Clinchd homepage hero animation
 * Replaces /animations/01-hero-demo.mp4 in src/components/landing/hero.jsx
 *
 * Loop timing (~12.8s total, 1s pause before restart):
 *   Beat 1 (0.3s):   Lead msg 1 fades in (left column)
 *   Beat 2 (1.5s):   AI typing dots appear
 *   Beat 3 (2.4s):   AI bubble 1 + word-stream begins (~80ms/word)
 *   Beat 4 (4.5s):   Lead msg 2 fades in
 *   Beat 5 (5.5s):   AI typing dots round 2
 *   Beat 6 (6.5s):   AI bubble 2 + word-stream
 *   Beat 7 (9.0s):   Right column — target slot highlights, others dim
 *   Beat 8 (9.7s):   BOOKED card slides up
 *   Beat 9 (10.5s):  Hold
 *   Beat 10 (11.8s): Fade out for clean loop
 *
 * Honors prefers-reduced-motion: shows final state without animation.
 *
 * Mirrors the GSAP patterns from src/components/landing/hero.jsx —
 * no new dependencies required (uses existing gsap from package.json).
 */

const LEAD_MSG_1 = "I've been trying to lose 20lbs for a year and nothing's working.";
const AI_MSG_1 = "Totally hear you. Quick q — are you more stuck on the consistency side or the plan itself?";
const LEAD_MSG_2 = "Honestly both. I need structure.";
const AI_MSG_2 = "Makes sense. I do a 15-min strategy call to map this out — Thu 10am or Fri 11am work?";

const SLOTS = [
  { day: "Tuesday", time: "2:00 PM" },
  { day: "Wednesday", time: "9:00 AM" },
  { day: "Thursday", time: "10:00 AM", isTarget: true },
  { day: "Friday", time: "11:00 AM" },
];

export default function HeroDemo() {
  const rootRef = useRef(null);
  const ai1Words = AI_MSG_1.split(" ");
  const ai2Words = AI_MSG_2.split(" ");

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const ctx = gsap.context(() => {
        gsap.set(
          [
            ".hd-lead-1",
            ".hd-ai-1",
            ".hd-lead-2",
            ".hd-ai-2",
            ".hd-word-1",
            ".hd-word-2",
            ".hd-booked",
          ],
          { opacity: 1, y: 0 }
        );
        gsap.set(".hd-slot-target", {
          backgroundColor: "#fff5f2",
          borderColor: "#ff7e67",
          scale: 1.015,
        });
        gsap.set(".hd-slot-other", { opacity: 0.4 });
        gsap.set(".hd-target-time", { color: "#ff7e67" });
        gsap.set([".hd-typing-1", ".hd-typing-2"], { opacity: 0 });
      }, rootRef);
      return () => ctx.revert();
    }

    const ctx = gsap.context(() => {
      // ─── INITIAL HIDDEN STATES ───
      gsap.set(".hd-lead-1", { opacity: 0, y: 12 });
      gsap.set(".hd-typing-1", { opacity: 0, scale: 0.95 });
      gsap.set(".hd-ai-1", { opacity: 0, y: 12 });
      gsap.set(".hd-word-1", { opacity: 0, y: 4 });
      gsap.set(".hd-lead-2", { opacity: 0, y: 12 });
      gsap.set(".hd-typing-2", { opacity: 0, scale: 0.95 });
      gsap.set(".hd-ai-2", { opacity: 0, y: 12 });
      gsap.set(".hd-word-2", { opacity: 0, y: 4 });
      gsap.set(".hd-booked", { opacity: 0, y: 20 });

      // ─── AMBIENT LOOPS (independent of main timeline) ───
      // Live dot pulse in metarow
      gsap.to(".hd-live-dot", {
        scale: 1.4,
        opacity: 0.4,
        duration: 0.75,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // Typing dots (always animating; visibility controlled by parent opacity)
      gsap.to(".hd-typing-dot", {
        opacity: 0.3,
        duration: 0.45,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.15, from: "start" },
      });

      // ─── MAIN TIMELINE ───
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1,
        defaults: { ease: "power2.out" },
      });

      // Beat 1: Lead 1
      tl.to(".hd-lead-1", { opacity: 1, y: 0, duration: 0.7 }, 0.3);

      // Beat 2: Typing 1
      tl.to(".hd-typing-1", { opacity: 1, scale: 1, duration: 0.4 }, 1.5);

      // Beat 3: Typing 1 fades, AI 1 bubble + word-stream
      tl.to(".hd-typing-1", { opacity: 0, scale: 0.95, duration: 0.3 }, 2.4);
      tl.to(".hd-ai-1", { opacity: 1, y: 0, duration: 0.5 }, 2.4);
      tl.to(
        ".hd-word-1",
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.08,
          ease: "power1.out",
        },
        2.7
      );

      // Beat 4: Lead 2
      tl.to(".hd-lead-2", { opacity: 1, y: 0, duration: 0.7 }, 4.5);

      // Beat 5: Typing 2
      tl.to(".hd-typing-2", { opacity: 1, scale: 1, duration: 0.4 }, 5.5);

      // Beat 6: Typing 2 fades, AI 2 bubble + word-stream
      tl.to(".hd-typing-2", { opacity: 0, scale: 0.95, duration: 0.3 }, 6.5);
      tl.to(".hd-ai-2", { opacity: 1, y: 0, duration: 0.5 }, 6.5);
      tl.to(
        ".hd-word-2",
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.08,
          ease: "power1.out",
        },
        6.8
      );

      // Beat 7: Calendar — target slot highlights, others dim
      tl.to(
        ".hd-slot-target",
        {
          backgroundColor: "#fff5f2",
          borderColor: "#ff7e67",
          scale: 1.015,
          duration: 0.5,
        },
        9.0
      );
      tl.to(".hd-target-time", { color: "#ff7e67", duration: 0.5 }, 9.0);
      tl.to(".hd-slot-other", { opacity: 0.4, duration: 0.5 }, 9.0);

      // Beat 8: BOOKED card slides up
      tl.to(".hd-booked", { opacity: 1, y: 0, duration: 0.6 }, 9.7);

      // Beat 10: Fade everything out for clean loop
      const fadeTargets = [
        ".hd-lead-1",
        ".hd-ai-1",
        ".hd-lead-2",
        ".hd-ai-2",
        ".hd-booked",
      ];
      tl.to(fadeTargets, { opacity: 0, duration: 0.6 }, 11.8);

      // Reset slot highlights for next loop
      tl.to(
        ".hd-slot-target",
        {
          backgroundColor: "#ffffff",
          borderColor: "#e7e5e4",
          scale: 1,
          duration: 0.6,
        },
        11.8
      );
      tl.to(".hd-target-time", { color: "#78716c", duration: 0.6 }, 11.8);
      tl.to(".hd-slot-other", { opacity: 1, duration: 0.6 }, 11.8);

      // Reset word streams for clean restart (instant, after fade)
      tl.set([".hd-word-1", ".hd-word-2"], { opacity: 0, y: 4 });
      tl.set([".hd-lead-1", ".hd-ai-1", ".hd-lead-2", ".hd-ai-2", ".hd-booked"], {
        y: 12,
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Clinchd AI handles a fitness lead's DM, qualifies them, and books a discovery call"
      className="w-full h-full"
    >
      <div
        className="grid grid-cols-1 md:grid-cols-[58%_1fr] bg-white border border-stone-200 rounded-[2rem] overflow-hidden divide-y md:divide-y-0 md:divide-x divide-stone-100"
      >
        {/* ─────────────── LEFT: DM CONVERSATION ─────────────── */}
        <div className="p-6 md:p-8">
          {/* Metarow */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
              Instagram · DM
            </span>
            <span
              className="hd-live-dot block w-2 h-2 rounded-full"
              style={{ background: "#ff7e67" }}
            />
          </div>

          {/* Chat stack */}
          <div className="mt-6" style={{ minHeight: "320px" }}>
            {/* Lead 1 */}
            <div className="hd-lead-1 flex justify-start mb-3">
              <div
                className="max-w-[85%] text-white text-[14px] leading-snug font-medium"
                style={{
                  background: "#1c1917",
                  padding: "0.75rem 1rem",
                  borderRadius: "1.25rem",
                  borderBottomLeftRadius: "0.375rem",
                }}
              >
                {LEAD_MSG_1}
              </div>
            </div>

            {/* Typing 1 */}
            <div className="hd-typing-1 flex justify-end mb-3">
              <div
                className="flex items-center gap-1.5"
                style={{
                  background: "#f5f5f4",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "1.25rem",
                  borderBottomRightRadius: "0.375rem",
                }}
              >
                <span className="hd-typing-dot block w-[5px] h-[5px] rounded-full bg-stone-400" />
                <span className="hd-typing-dot block w-[5px] h-[5px] rounded-full bg-stone-400" />
                <span className="hd-typing-dot block w-[5px] h-[5px] rounded-full bg-stone-400" />
              </div>
            </div>

            {/* AI 1 */}
            <div className="hd-ai-1 flex justify-end mb-3">
              <div
                className="max-w-[85%] text-stone-900 text-[14px] leading-snug font-medium"
                style={{
                  background: "#f5f5f4",
                  padding: "0.75rem 1rem",
                  borderRadius: "1.25rem",
                  borderBottomRightRadius: "0.375rem",
                }}
              >
                {ai1Words.map((word, i) => (
                  <span key={i} className="hd-word-1 inline-block">
                    {word}
                    {i < ai1Words.length - 1 ? "\u00A0" : ""}
                  </span>
                ))}
              </div>
            </div>

            {/* Lead 2 */}
            <div className="hd-lead-2 flex justify-start mb-3">
              <div
                className="max-w-[85%] text-white text-[14px] leading-snug font-medium"
                style={{
                  background: "#1c1917",
                  padding: "0.75rem 1rem",
                  borderRadius: "1.25rem",
                  borderBottomLeftRadius: "0.375rem",
                }}
              >
                {LEAD_MSG_2}
              </div>
            </div>

            {/* Typing 2 */}
            <div className="hd-typing-2 flex justify-end mb-3">
              <div
                className="flex items-center gap-1.5"
                style={{
                  background: "#f5f5f4",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "1.25rem",
                  borderBottomRightRadius: "0.375rem",
                }}
              >
                <span className="hd-typing-dot block w-[5px] h-[5px] rounded-full bg-stone-400" />
                <span className="hd-typing-dot block w-[5px] h-[5px] rounded-full bg-stone-400" />
                <span className="hd-typing-dot block w-[5px] h-[5px] rounded-full bg-stone-400" />
              </div>
            </div>

            {/* AI 2 */}
            <div className="hd-ai-2 flex justify-end">
              <div
                className="max-w-[85%] text-stone-900 text-[14px] leading-snug font-medium"
                style={{
                  background: "#f5f5f4",
                  padding: "0.75rem 1rem",
                  borderRadius: "1.25rem",
                  borderBottomRightRadius: "0.375rem",
                }}
              >
                {ai2Words.map((word, i) => (
                  <span key={i} className="hd-word-2 inline-block">
                    {word}
                    {i < ai2Words.length - 1 ? "\u00A0" : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────── RIGHT: CALENDAR ─────────────── */}
        <div className="p-6 md:p-8 bg-stone-50">
          {/* Metarow */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
              Calendar · 15 min
            </span>
          </div>

          <h3
            className="text-stone-900 mt-5 mb-3.5"
            style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: "20px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Suggested times
          </h3>

          <div className="flex flex-col gap-2">
            {SLOTS.map((slot, i) => (
              <div
                key={i}
                className={
                  slot.isTarget ? "hd-slot-target" : "hd-slot-other"
                }
                style={{
                  padding: "0.75rem 1rem",
                  background: "#ffffff",
                  border: "1px solid #e7e5e4",
                  borderRadius: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span className="text-[13px] font-bold text-stone-900">
                  {slot.day}
                </span>
                <span
                  className={slot.isTarget ? "hd-target-time" : ""}
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#78716c",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {slot.time}
                </span>
              </div>
            ))}
          </div>

          {/* Booked confirmation card */}
          <div
            className="hd-booked"
            style={{
              marginTop: "1.25rem",
              padding: "1rem 1.25rem",
              background: "#fff5f2",
              border: "1px solid rgba(255, 126, 103, 0.25)",
              borderRadius: "1.25rem",
              display: "flex",
              alignItems: "center",
              gap: "0.875rem",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9999px",
                background: "#ff7e67",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  color: "#ff7e67",
                  marginBottom: "2px",
                }}
              >
                Booked
              </div>
              <div
                style={{
                  fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#1c1917",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.2,
                }}
              >
                Thursday, 10:00 AM
              </div>
              <div className="text-[11px] font-medium text-stone-500 mt-[2px]">
                Strategy Call · 15 min
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
