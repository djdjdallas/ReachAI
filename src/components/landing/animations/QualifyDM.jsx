"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * QualifyDM — Clinchd homepage animation for "Step 02: AI Qualifies Every DM"
 *
 * Loop timing (~10.5s total):
 *   Beat 1 (0.3s–1.0s):  Lead's DM slides in from bottom-left
 *   Beat 2 (1.2s–2.0s):  AI typing dots appear and pulse
 *   Beat 3 (2.0s–4.9s):  Typing fades out; AI bubble + word-fade streaming
 *   Beat 4 (5.5s–7.0s):  "LEAD QUALIFIED" status row slides up
 *   Beat 5 (7.0s–9.5s):  Hold state
 *   Beat 6 (9.5s–10.5s): Fade out + restart
 *
 * Honors prefers-reduced-motion: shows final state without animation.
 *
 * This component mirrors the GSAP patterns from Clinchd's existing
 * src/components/landing/hero.jsx — no new dependencies required.
 */

const LEAD_MESSAGE = "Honestly, it's too expensive for me right now.";
const AI_REPLY =
  "Totally fair. Most clients earn it back in the first two bookings — want me to show you the math on your niche?";

export default function QualifyDM() {
  const rootRef = useRef(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const ctx = gsap.context(() => {
        gsap.set(
          [
            ".qdm-lead",
            ".qdm-ai-bubble",
            ".qdm-word",
            ".qdm-status",
          ],
          { opacity: 1, y: 0 }
        );
        gsap.set(".qdm-typing", { opacity: 0 });
      }, rootRef);
      return () => ctx.revert();
    }

    const ctx = gsap.context(() => {
      // Initial hidden states
      gsap.set(".qdm-lead", { opacity: 0, y: 12 });
      gsap.set(".qdm-typing", { opacity: 0, scale: 0.95 });
      gsap.set(".qdm-ai-bubble", { opacity: 0, y: 12 });
      gsap.set(".qdm-word", { opacity: 0, y: 4 });
      gsap.set(".qdm-status", { opacity: 0, y: 8 });
      gsap.set(".qdm-cursor", { opacity: 0 });

      // Ambient live-dot pulse (infinite, independent of main loop)
      gsap.to(".qdm-live-dot", {
        scale: 1.3,
        opacity: 0.4,
        duration: 1.2,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // Typing dot pulse (infinite, independent)
      gsap.to(".qdm-typing-dot", {
        opacity: 0.3,
        duration: 0.5,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.15, from: "start" },
      });

      // Main timeline — loops
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1,
        defaults: { ease: "power2.out" },
      });

      // Beat 1: Lead DM slides in
      tl.to(".qdm-lead", { opacity: 1, y: 0, duration: 0.7 }, 0.3);

      // Beat 2: Typing dots
      tl.to(".qdm-typing", { opacity: 1, scale: 1, duration: 0.4 }, 1.2);

      // Beat 3a: Typing fades out, AI bubble appears
      tl.to(".qdm-typing", { opacity: 0, scale: 0.95, duration: 0.3 }, 2.0);
      tl.to(".qdm-ai-bubble", { opacity: 1, y: 0, duration: 0.5 }, 2.1);

      // Beat 3b: Word-fade streaming
      tl.to(
        ".qdm-word",
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.085,
          ease: "power1.out",
        },
        2.5
      );

      // Cursor blink after words finish (23 words * 0.085s ≈ 1.95s + 2.5 start = ~4.45s)
      tl.to(".qdm-cursor", { opacity: 1, duration: 0.15 }, 4.6);
      tl.to(
        ".qdm-cursor",
        {
          opacity: 0,
          duration: 0.3,
          repeat: 3,
          yoyo: true,
        },
        4.8
      );

      // Beat 4: Qualified status slides up
      tl.to(".qdm-status", { opacity: 1, y: 0, duration: 0.6 }, 5.5);

      // Beat 6: Fade everything out for clean loop
      tl.to(
        [".qdm-lead", ".qdm-ai-bubble", ".qdm-status", ".qdm-cursor"],
        { opacity: 0, duration: 0.6 },
        9.5
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  const words = AI_REPLY.split(" ");

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="Demonstration of Clinchd AI replying to a DM objection and qualifying the lead"
      className="w-full"
    >
      <div
        className="bg-white border border-stone-200 rounded-[2rem] p-7"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}
      >
        {/* Top metadata row */}
        <div className="flex items-center justify-between mb-7">
          <span className="text-[11px] font-bold uppercase text-stone-500 tracking-[0.12em]">
            Live · Conversation
          </span>
          <span
            className="qdm-live-dot block w-2 h-2 rounded-full"
            style={{ background: "#ff7e67" }}
          />
        </div>

        {/* Chat stack */}
        <div className="mb-7" style={{ minHeight: "260px" }}>
          {/* Lead message — left aligned, dark bubble */}
          <div className="qdm-lead flex justify-start mb-4">
            <div
              className="max-w-[85%] text-white text-[15px] leading-snug font-medium"
              style={{
                background: "#1c1917",
                padding: "0.85rem 1.15rem",
                borderRadius: "1.25rem",
                borderBottomLeftRadius: "0.375rem",
              }}
            >
              {LEAD_MESSAGE}
            </div>
          </div>

          {/* Typing indicator — right aligned */}
          <div className="qdm-typing flex justify-end mb-4">
            <div
              className="flex items-center gap-1.5"
              style={{
                background: "#f5f5f4",
                padding: "0.75rem 1rem",
                borderRadius: "1.25rem",
                borderBottomRightRadius: "0.375rem",
              }}
            >
              <span className="qdm-typing-dot block w-1.5 h-1.5 rounded-full bg-stone-400" />
              <span className="qdm-typing-dot block w-1.5 h-1.5 rounded-full bg-stone-400" />
              <span className="qdm-typing-dot block w-1.5 h-1.5 rounded-full bg-stone-400" />
            </div>
          </div>

          {/* AI reply — right aligned, word-fade */}
          <div className="qdm-ai-bubble flex justify-end">
            <div
              className="max-w-[85%] text-stone-900 text-[15px] leading-snug font-medium"
              style={{
                background: "#f5f5f4",
                padding: "0.85rem 1.15rem",
                borderRadius: "1.25rem",
                borderBottomRightRadius: "0.375rem",
              }}
            >
              {words.map((word, i) => (
                <span key={i} className="qdm-word inline-block">
                  {word}
                  {i < words.length - 1 ? "\u00A0" : ""}
                </span>
              ))}
              <span
                className="qdm-cursor inline-block align-middle ml-0.5"
                style={{
                  width: "2px",
                  height: "1em",
                  background: "#1c1917",
                }}
              />
            </div>
          </div>
        </div>

        {/* Status row — "Lead Qualified" */}
        <div
          className="qdm-status flex items-center justify-between pt-5"
          style={{ borderTop: "1px solid #f5f5f4" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="block w-1.5 h-1.5 rounded-full"
              style={{ background: "#ff7e67" }}
            />
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "#ff7e67" }}
            >
              Lead Qualified
            </span>
          </div>
          <span className="text-[11px] font-medium text-stone-400">
            Objection handled · Ready to book
          </span>
        </div>
      </div>
    </div>
  );
}
