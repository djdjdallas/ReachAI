"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * ConnectSetup — Clinchd homepage animation for "Step 01: Connect & Describe Your Offer"
 * Replaces /animations/04-smart-replies.mp4
 *
 * Loop timing (~10.5s total, 1s pause before restart):
 *   Beat 1 (0.3s):  Step 1 connection card fades in
 *   Beat 2 (0.8s):  Connecting dots pulse
 *   Beat 3 (1.6s):  Coral check + "Connected" replaces dots
 *   Beat 4 (2.0s):  Step 2 textarea card fades in
 *   Beat 5 (2.3s):  Offer text typewriters in (~35ms/char)
 *   Beat 6 (5.0s):  Step 3 textarea card fades in
 *   Beat 7 (5.3s):  Ideal client typewriters in
 *   Beat 8 (8.0s):  "READY TO GO" pill scales in
 *   Beat 9 (9.5s):  Fade out for clean loop
 *
 * Honors prefers-reduced-motion: shows final state without animation.
 *
 * Mirrors the GSAP patterns from src/components/landing/hero.jsx —
 * no new dependencies required.
 *
 * NOTE: This is the only animation in the set that uses character-by-character
 * typewriter — because we're literally showing a user typing into form fields.
 * It's on-concept here. Everywhere else uses word-fade.
 */

const OFFER_TEXT =
  "I help career coaches replace their 9-5 in 12 months with a proven framework.";
const CLIENT_TEXT = "Working with professionals earning $80K+ ready to leap.";

export default function ConnectSetup() {
  const rootRef = useRef(null);
  // Counters drive React state for typewriter (GSAP can't directly animate text content)
  const [offerChars, setOfferChars] = useState(0);
  const [clientChars, setClientChars] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const ctx = gsap.context(() => {
        gsap.set(
          [
            ".cs-card",
            ".cs-step1",
            ".cs-step2",
            ".cs-step3",
            ".cs-connected",
            ".cs-ready",
          ],
          { opacity: 1, y: 0, scale: 1 }
        );
        gsap.set(".cs-step2, .cs-step3", { maxHeight: "300px" });
        gsap.set(".cs-connecting", { opacity: 0 });
      }, rootRef);
      setOfferChars(OFFER_TEXT.length);
      setClientChars(CLIENT_TEXT.length);
      return () => ctx.revert();
    }

    const ctx = gsap.context(() => {
      // Initial states
      gsap.set(".cs-card", { opacity: 0, y: 8 });
      gsap.set(".cs-step1", { opacity: 0, y: 8 });
      gsap.set(".cs-step2", { opacity: 0, y: 8, maxHeight: 0, marginTop: 0 });
      gsap.set(".cs-step3", { opacity: 0, y: 8, maxHeight: 0, marginTop: 0 });
      gsap.set(".cs-connecting", { opacity: 0 });
      gsap.set(".cs-connected", { opacity: 0, scale: 0.85 });
      gsap.set(".cs-ready", { opacity: 0, scale: 0.96 });

      // Connecting-dots ambient pulse (only visible during phase 2)
      gsap.to(".cs-connecting-dot", {
        backgroundColor: "#78716c",
        duration: 0.28,
        ease: "sine.inOut",
        stagger: { each: 0.28, repeat: -1 },
      });

      // Ready-pill ambient pulse
      gsap.to(".cs-ready-pulse", {
        scale: 1.8,
        opacity: 0,
        duration: 1.4,
        ease: "sine.out",
        repeat: -1,
      });

      // Main loop
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1,
        defaults: { ease: "power2.out" },
        onRepeat: () => {
          // Reset counters on each loop iteration
          setOfferChars(0);
          setClientChars(0);
        },
      });

      // Beat 1: Card + Step 1 fade in
      tl.to(".cs-card", { opacity: 1, y: 0, duration: 0.5 }, 0.3);
      tl.to(".cs-step1", { opacity: 1, y: 0, duration: 0.5 }, 0.4);

      // Beat 2: Connecting dots
      tl.to(".cs-connecting", { opacity: 1, duration: 0.3 }, 0.8);

      // Beat 3: Connecting fades, Connected check appears
      tl.to(".cs-connecting", { opacity: 0, duration: 0.25 }, 1.6);
      tl.to(
        ".cs-connected",
        { opacity: 1, scale: 1, duration: 0.4 },
        1.65
      );

      // Beat 4: Step 2 expands and fades in
      tl.to(
        ".cs-step2",
        {
          opacity: 1,
          y: 0,
          maxHeight: 200,
          marginTop: 12,
          duration: 0.5,
        },
        2.0
      );

      // Beat 5: Offer typewriter (using GSAP to drive React state)
      // Using a proxy + onUpdate is cleaner than chained setTimeouts here
      const offerProxy = { v: 0 };
      tl.to(
        offerProxy,
        {
          v: OFFER_TEXT.length,
          duration: OFFER_TEXT.length * 0.035, // ~2.7s for 78 chars
          ease: "none",
          onUpdate: () => setOfferChars(Math.floor(offerProxy.v)),
        },
        2.3
      );

      // Beat 6: Step 3 expands and fades in
      tl.to(
        ".cs-step3",
        {
          opacity: 1,
          y: 0,
          maxHeight: 200,
          marginTop: 12,
          duration: 0.5,
        },
        5.0
      );

      // Beat 7: Client typewriter
      const clientProxy = { v: 0 };
      tl.to(
        clientProxy,
        {
          v: CLIENT_TEXT.length,
          duration: CLIENT_TEXT.length * 0.035, // ~2s for 56 chars
          ease: "none",
          onUpdate: () => setClientChars(Math.floor(clientProxy.v)),
        },
        5.3
      );

      // Beat 8: Ready pill
      tl.to(".cs-ready", { opacity: 1, scale: 1, duration: 0.5 }, 8.0);

      // Beat 9: Fade out for clean loop
      tl.to(".cs-card", { opacity: 0, duration: 0.6 }, 9.5);

      // Reset states for next iteration (instant, post-fade)
      tl.set(".cs-card", { y: 8 });
      tl.set([".cs-step1", ".cs-step2", ".cs-step3"], { opacity: 0, y: 8 });
      tl.set([".cs-step2", ".cs-step3"], { maxHeight: 0, marginTop: 0 });
      tl.set(".cs-connecting", { opacity: 0 });
      tl.set(".cs-connected", { opacity: 0, scale: 0.85 });
      tl.set(".cs-ready", { opacity: 0, scale: 0.96 });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // For the focus glow on the active textarea — derive from chars progress
  const offerFocused = offerChars > 0 && offerChars < OFFER_TEXT.length;
  const clientFocused = clientChars > 0 && clientChars < CLIENT_TEXT.length;

  return (
    <div ref={rootRef} className="w-full">
      <div
        className="cs-card bg-white border border-stone-200 rounded-[2rem] p-7"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}
        role="img"
        aria-label="Clinchd onboarding flow showing Instagram connection, offer description, and ideal client setup"
      >
        {/* Top metadata row */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
            Setup · ~5 minutes
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">
            Step 1 of 3
          </span>
        </div>

        {/* Step 1: Connect Instagram */}
        <div
          className="cs-step1 bg-stone-50 border border-stone-100 rounded-[1.25rem] p-4 relative"
        >
          <span
            className="absolute top-3 right-4 text-stone-300"
            style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.05em",
            }}
          >
            01
          </span>
          <div className="flex items-center gap-3.5">
            <InstagramAvatar />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-bold text-stone-900 mb-[2px]">
                Connect account
              </div>
              <div className="text-[12px] font-medium text-stone-500">
                @yourcoachhandle
              </div>
            </div>

            {/* Status area — connecting + connected stack on top of each other */}
            <div
              className="text-right relative"
              style={{ minWidth: "110px", height: "20px" }}
            >
              {/* Connecting dots */}
              <div className="cs-connecting absolute right-0 top-0 inline-flex items-center gap-2">
                <span className="text-[12px] font-semibold text-stone-500">
                  Connecting
                </span>
                <div className="flex gap-[3px]">
                  <span
                    className="cs-connecting-dot block w-1 h-1 rounded-full"
                    style={{ background: "#d6d3d1" }}
                  />
                  <span
                    className="cs-connecting-dot block w-1 h-1 rounded-full"
                    style={{ background: "#d6d3d1" }}
                  />
                  <span
                    className="cs-connecting-dot block w-1 h-1 rounded-full"
                    style={{ background: "#d6d3d1" }}
                  />
                </div>
              </div>
              {/* Connected check */}
              <div className="cs-connected absolute right-0 top-0 inline-flex items-center gap-1.5">
                <div
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: "#ff7e67" }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span
                  className="text-[12px] font-bold"
                  style={{ color: "#ff7e67" }}
                >
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Describe Your Offer */}
        <div
          className="cs-step2 bg-stone-50 border border-stone-100 rounded-[1.25rem] p-4 relative"
          style={{ overflow: "hidden" }}
        >
          <span
            className="absolute top-3 right-4 text-stone-300"
            style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.05em",
            }}
          >
            02
          </span>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400 mb-2">
            Describe your offer
          </div>
          <TextareaContent
            fullText={OFFER_TEXT}
            charsRevealed={offerChars}
            isFocused={offerFocused}
          />
        </div>

        {/* Step 3: Ideal Client */}
        <div
          className="cs-step3 bg-stone-50 border border-stone-100 rounded-[1.25rem] p-4 relative"
          style={{ overflow: "hidden" }}
        >
          <span
            className="absolute top-3 right-4 text-stone-300"
            style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: "11px",
              fontWeight: 800,
              letterSpacing: "0.05em",
            }}
          >
            03
          </span>
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400 mb-2">
            Ideal client
          </div>
          <TextareaContent
            fullText={CLIENT_TEXT}
            charsRevealed={clientChars}
            isFocused={clientFocused}
          />
        </div>

        {/* READY TO GO pill */}
        <div className="mt-5 flex justify-center">
          <div
            className="cs-ready inline-flex items-center gap-2 rounded-full"
            style={{
              padding: "0.625rem 1.25rem",
              background: "#fff5f2",
              border: "1px solid rgba(255, 126, 103, 0.3)",
            }}
          >
            <span
              className="relative block w-2 h-2 rounded-full"
              style={{ background: "#ff7e67" }}
            >
              <span
                className="cs-ready-pulse absolute rounded-full"
                style={{
                  inset: "-3px",
                  background: "#ff7e67",
                  opacity: 0.4,
                }}
              />
            </span>
            <span
              className="text-[13px] font-extrabold uppercase"
              style={{
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                letterSpacing: "0.1em",
                color: "#ff7e67",
              }}
            >
              Ready to go
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   InstagramAvatar — abstract square mark, NOT the IG logo
   (avoids trademark issues; consistent with Meta App Review framing)
   ───────────────────────────────────────────────────────────── */

function InstagramAvatar() {
  return (
    <div
      className="rounded-xl flex items-center justify-center flex-shrink-0"
      style={{
        width: "40px",
        height: "40px",
        background:
          "linear-gradient(135deg, #fcefe8 0%, #ffe0d4 50%, #ffd4c2 100%)",
        border: "1px solid rgba(255, 126, 103, 0.15)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="3"
          width="18"
          height="18"
          rx="5"
          stroke="#ff7e67"
          strokeWidth="2"
          opacity="0.6"
        />
        <circle
          cx="12"
          cy="12"
          r="4"
          stroke="#ff7e67"
          strokeWidth="2"
          opacity="0.6"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   TextareaContent — typewriter text reveal
   ───────────────────────────────────────────────────────────── */

function TextareaContent({ fullText, charsRevealed, isFocused }) {
  const [cursorOn, setCursorOn] = useState(true);

  useEffect(() => {
    if (!isFocused) return;
    const iv = setInterval(() => setCursorOn((v) => !v), 530);
    return () => clearInterval(iv);
  }, [isFocused]);

  return (
    <div
      style={{
        background: "#ffffff",
        border: isFocused
          ? "1px solid rgba(255, 126, 103, 0.35)"
          : "1px solid #e7e5e4",
        borderRadius: "0.75rem",
        padding: "0.75rem 0.875rem",
        minHeight: "60px",
        fontSize: "14px",
        lineHeight: 1.5,
        fontWeight: 500,
        color: "#1c1917",
        transition: "border 0.3s ease-out, box-shadow 0.3s ease-out",
        boxShadow: isFocused
          ? "0 0 0 3px rgba(255, 126, 103, 0.08)"
          : "none",
      }}
    >
      <span>{fullText.slice(0, charsRevealed)}</span>
      {isFocused && (
        <span
          style={{
            display: "inline-block",
            width: "2px",
            height: "1em",
            background: "#1c1917",
            marginLeft: "1px",
            verticalAlign: "middle",
            opacity: cursorOn ? 1 : 0,
            transition: "opacity 0.1s linear",
          }}
        />
      )}
    </div>
  );
}
