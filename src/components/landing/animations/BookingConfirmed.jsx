"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * BookingConfirmed — Clinchd homepage animation for "Step 03: Discovery Calls Get Booked"
 * Replaces /animations/05-calendar-booking.mp4
 *
 * Loop timing (~9.5s total, 1s pause before restart):
 *   Beat 1 (0.1s):   Card fades in; 4 slots stagger in (120ms each)
 *   Beat 2 (1.5s):   Coral cursor glides from off-screen-right toward target
 *   Beat 3 (3.0s):   Target slot scales + turns coral; other slots dim to 0.4
 *   Beat 4 (4.2s):   "Lead picked a time" helper fades in
 *   Beat 5 (5.5s):   BOOKED card slides up + check icon scales in
 *   Beat 6 (7.5s):   Hold
 *   Beat 7 (8.5s):   Fade everything out for clean loop
 *
 * Honors prefers-reduced-motion: shows final state without animation.
 *
 * Mirrors the GSAP patterns from src/components/landing/hero.jsx —
 * no new dependencies required.
 */

const SLOTS = [
  { day: "Tuesday", date: "Mar 12", time: "2:00 PM" },
  { day: "Wednesday", date: "Mar 13", time: "9:00 AM" },
  { day: "Thursday", date: "Mar 14", time: "10:00 AM", isTarget: true },
  { day: "Friday", date: "Mar 15", time: "11:00 AM" },
];

export default function BookingConfirmed() {
  const rootRef = useRef(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const ctx = gsap.context(() => {
        gsap.set([".bc-slot", ".bc-helper", ".bc-booked"], {
          opacity: 1,
          y: 0,
        });
        gsap.set(".bc-slot-target", {
          backgroundColor: "#fff5f2",
          borderColor: "#ff7e67",
          scale: 1.015,
        });
        gsap.set(".bc-slot-other", { opacity: 0.35 });
        gsap.set(".bc-target-time", { color: "#ff7e67" });
        gsap.set(".bc-cursor", { opacity: 0 });
        gsap.set(".bc-cursor-trail", { opacity: 0 });
        gsap.set(".bc-check", { scale: 1 });
      }, rootRef);
      return () => ctx.revert();
    }

    const ctx = gsap.context(() => {
      // ─── INITIAL HIDDEN STATES ───
      gsap.set(".bc-card", { opacity: 0, y: 8 });
      gsap.set(".bc-slot", { opacity: 0, y: 8 });
      gsap.set(".bc-cursor", { opacity: 0, x: 60 });
      gsap.set(".bc-cursor-trail", { opacity: 0, x: 60 });
      gsap.set(".bc-helper", { opacity: 0, y: 4 });
      gsap.set(".bc-booked", { opacity: 0, y: 20 });
      gsap.set(".bc-check", { scale: 0.8 });

      // Ambient live-dot pulse on the booked card
      gsap.to(".bc-live-dot", {
        scale: 1.4,
        opacity: 0.4,
        duration: 1.3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });

      // ─── MAIN TIMELINE ───
      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1,
        defaults: { ease: "power2.out" },
      });

      // Beat 1: Card fades in
      tl.to(".bc-card", { opacity: 1, y: 0, duration: 0.5 }, 0.1);

      // Beat 1b: Slots stagger in
      tl.to(
        ".bc-slot",
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.12,
        },
        0.3
      );

      // Beat 2: Cursor approaches target
      tl.to(".bc-cursor", { opacity: 1, x: 0, duration: 1.2 }, 1.5);
      tl.to(
        ".bc-cursor-trail",
        { opacity: 0.15, x: 0, duration: 1.2 },
        1.5
      );

      // Beat 3: Cursor disappears, target slot lights up, others dim
      tl.to(".bc-cursor", { opacity: 0, duration: 0.3 }, 3.0);
      tl.to(".bc-cursor-trail", { opacity: 0, duration: 0.3 }, 3.0);
      tl.to(
        ".bc-slot-target",
        {
          backgroundColor: "#fff5f2",
          borderColor: "#ff7e67",
          scale: 1.015,
          duration: 0.5,
        },
        3.0
      );
      tl.to(".bc-target-time", { color: "#ff7e67", duration: 0.5 }, 3.0);
      tl.to(".bc-slot-other", { opacity: 0.35, duration: 0.5 }, 3.0);

      // Beat 4: Helper text
      tl.to(".bc-helper", { opacity: 1, y: 0, duration: 0.5 }, 4.2);

      // Beat 5: BOOKED card slides up + check scales in
      tl.to(".bc-booked", { opacity: 1, y: 0, duration: 0.6 }, 5.5);
      tl.to(
        ".bc-check",
        { scale: 1, duration: 0.5, ease: "back.out(1.6)" },
        5.8
      );

      // Beat 7: Fade out for clean loop
      tl.to(
        [".bc-card"],
        { opacity: 0, duration: 0.6 },
        8.5
      );

      // Reset states for next loop (instant, after fade)
      tl.set([".bc-slot", ".bc-helper", ".bc-booked"], { opacity: 0 });
      tl.set(".bc-slot", { y: 8 });
      tl.set(".bc-helper", { y: 4 });
      tl.set(".bc-booked", { y: 20 });
      tl.set(".bc-cursor", { opacity: 0, x: 60 });
      tl.set(".bc-cursor-trail", { opacity: 0, x: 60 });
      tl.set(".bc-check", { scale: 0.8 });
      tl.set(".bc-card", { y: 8 });

      // Reset slot highlights
      tl.set(".bc-slot-target", {
        backgroundColor: "#ffffff",
        borderColor: "#e7e5e4",
        scale: 1,
      });
      tl.set(".bc-target-time", { color: "#78716c" });
      tl.set(".bc-slot-other", { opacity: 0 });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label="A qualified lead picks a time slot from the calendar and the booking is confirmed"
      className="w-full"
    >
      <div
        className="bc-card bg-white border border-stone-200 rounded-[2rem] p-7 relative overflow-hidden"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}
      >
        {/* Top metadata row */}
        <div className="flex items-center justify-between mb-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
            Calendly · Discovery Call
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400">
            15 min
          </span>
        </div>

        {/* Heading */}
        <h3
          className="text-stone-900 mb-5"
          style={{
            fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
            fontSize: "24px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "0 0 1.25rem 0",
          }}
        >
          Suggested times
        </h3>

        {/* Slot list */}
        <div className="flex flex-col gap-2 relative">
          {SLOTS.map((slot, i) => (
            <div
              key={i}
              className={`bc-slot ${
                slot.isTarget ? "bc-slot-target" : "bc-slot-other"
              } flex items-center justify-between`}
              style={{
                padding: "0.875rem 1.125rem",
                background: "#ffffff",
                border: "1px solid #e7e5e4",
                borderRadius: "1rem",
              }}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[14px] font-bold text-stone-900">
                  {slot.day}
                </span>
                <span className="text-[12px] font-medium text-stone-400">
                  {slot.date}
                </span>
              </div>
              <span
                className={slot.isTarget ? "bc-target-time" : ""}
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#78716c",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {slot.time}
              </span>
            </div>
          ))}

          {/* Cursor trail (subtle blur, behind main dot) */}
          <span
            className="bc-cursor-trail"
            style={{
              position: "absolute",
              width: "20px",
              height: "20px",
              borderRadius: "9999px",
              background: "#ff7e67",
              right: "1.5rem",
              // Target index 2 → vertical center: 2 * (slotHeight + gap) + slotHeight/2
              // Slots are ~52px tall with 8px gap between them.
              top: "calc(2 * 60px + 26px)",
              transform: "translateY(-50%)",
              filter: "blur(10px)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />

          {/* Main coral cursor dot */}
          <span
            className="bc-cursor"
            style={{
              position: "absolute",
              width: "10px",
              height: "10px",
              borderRadius: "9999px",
              background: "#ff7e67",
              right: "1.5rem",
              top: "calc(2 * 60px + 26px)",
              transform: "translateY(-50%)",
              boxShadow: "0 0 0 4px rgba(255, 126, 103, 0.18)",
              pointerEvents: "none",
              zIndex: 6,
            }}
          />
        </div>

        {/* Helper text */}
        <p
          className="bc-helper text-[13px] font-medium text-stone-500"
          style={{ marginTop: "1rem", marginBottom: 0 }}
        >
          Lead picked a time
        </p>

        {/* BOOKED confirmation card */}
        <div
          className="bc-booked flex items-center gap-3.5"
          style={{
            marginTop: "1.25rem",
            padding: "1.125rem 1.25rem",
            background: "#fff5f2",
            border: "1px solid rgba(255, 126, 103, 0.25)",
            borderRadius: "1.25rem",
          }}
        >
          <div
            className="bc-check flex items-center justify-center flex-shrink-0"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "9999px",
              background: "#ff7e67",
            }}
          >
            <svg
              width="20"
              height="20"
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
                fontSize: "18px",
                fontWeight: 700,
                color: "#1c1917",
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              Thursday, March 14 · 10:00 AM
            </div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#78716c",
                marginTop: "2px",
              }}
            >
              Strategy Call · Calendar invite sent
            </div>
          </div>
          {/* Live dot */}
          <span
            className="bc-live-dot block flex-shrink-0"
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "9999px",
              background: "#ff7e67",
            }}
          />
        </div>
      </div>
    </div>
  );
}
