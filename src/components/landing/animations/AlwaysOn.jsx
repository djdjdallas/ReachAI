"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

/**
 * AlwaysOn — Clinchd homepage animation for "Always on. Always responding."
 * Replaces /animations/02-availability-24x7.mp4
 *
 * BEHAVIOR: Atmospheric piece beneath the "DMs leaking revenue" pain-point
 * cards. A coral dot orbits a 24-hour dial. Three notification pills appear
 * at specific times during the orbit (3 AM, 7 AM, 11 PM).
 *
 * Loop timing (~12 seconds = one full orbit + restart):
 *   Beat 1 (0–11s):  Coral dot orbits 24-hour ring (1 full revolution)
 *   Beat 2 (~2s):    Notification pill 1 — "3:14 AM · NEW LEAD"
 *   Beat 3 (~5s):    Notification pill 2 — "7:22 AM · OBJECTION HANDLED"
 *   Beat 4 (~8s):    Notification pill 3 — "11:47 PM · CALL BOOKED" (coral)
 *   Beat 5 (~11s):   Brief hold, restart
 *
 * Honors prefers-reduced-motion: shows static dial with all 3 pills visible
 * simultaneously, no orbit.
 *
 * Mirrors the GSAP patterns from src/components/landing/hero.jsx —
 * no new dependencies required.
 */

const NOTIFICATIONS = [
  {
    id: "n1",
    time: "3:14 AM",
    label: "New lead",
    angle: 47,
    showAt: 1.8,
    hideAt: 4.0,
  },
  {
    id: "n2",
    time: "7:22 AM",
    label: "Objection handled",
    angle: 110,
    showAt: 4.5,
    hideAt: 7.0,
  },
  {
    id: "n3",
    time: "11:47 PM",
    label: "Call booked",
    angle: 357,
    showAt: 7.8,
    hideAt: 10.5,
    accent: true,
  },
];

const ORBIT_DURATION = 11; // seconds per full revolution
const RING_SIZE = 360;
const RING_RADIUS = 130;

export default function AlwaysOn() {
  const rootRef = useRef(null);
  // Orbit progress (0..1) drives both dot position and tick lighting
  const [orbitProgress, setOrbitProgress] = useState(0);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Static state: show all pills, no orbit
      setOrbitProgress(0);
      const ctx = gsap.context(() => {
        gsap.set([".ao-pill"], { opacity: 1, scale: 1 });
        gsap.set(".ao-orbit-dot", { opacity: 0 });
      }, rootRef);
      return () => ctx.revert();
    }

    const ctx = gsap.context(() => {
      // Initial pill states
      gsap.set(".ao-pill", { opacity: 0, scale: 0.92 });

      // Live indicator pulse (independent of main loop)
      gsap.to(".ao-live-pulse", {
        scale: 1.8,
        opacity: 0,
        duration: 1.5,
        ease: "sine.out",
        repeat: -1,
      });

      // Main orbit timeline — drives orbitProgress via React state
      // We use a proxy object that GSAP tweens, then read into React.
      const orbitProxy = { v: 0 };

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 1,
        defaults: { ease: "none" },
      });

      // Reset proxy + reset all pills at start of each loop
      tl.call(() => {
        orbitProxy.v = 0;
        setOrbitProgress(0);
      });

      // The orbit itself
      tl.to(orbitProxy, {
        v: 1,
        duration: ORBIT_DURATION,
        ease: "none",
        onUpdate: () => setOrbitProgress(orbitProxy.v),
      });

      // Pill 1: in at 1.8s, out at 4.0s
      tl.to(
        "#ao-pill-n1",
        { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" },
        1.8
      );
      tl.to(
        "#ao-pill-n1",
        { opacity: 0, scale: 0.92, duration: 0.5, ease: "power2.in" },
        4.0
      );

      // Pill 2: in at 4.5s, out at 7.0s
      tl.to(
        "#ao-pill-n2",
        { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" },
        4.5
      );
      tl.to(
        "#ao-pill-n2",
        { opacity: 0, scale: 0.92, duration: 0.5, ease: "power2.in" },
        7.0
      );

      // Pill 3: in at 7.8s, out at 10.5s
      tl.to(
        "#ao-pill-n3",
        { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" },
        7.8
      );
      tl.to(
        "#ao-pill-n3",
        { opacity: 0, scale: 0.92, duration: 0.5, ease: "power2.in" },
        10.5
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // Compute orbit dot position from progress
  const dotAngle = orbitProgress * 360 - 90;
  const dotRad = (dotAngle * Math.PI) / 180;
  const dotX = RING_SIZE / 2 + Math.cos(dotRad) * RING_RADIUS;
  const dotY = RING_SIZE / 2 + Math.sin(dotRad) * RING_RADIUS;

  return (
    <div ref={rootRef} className="w-full">
      <div
        className="bg-white border border-stone-200 rounded-[2rem] relative"
        style={{
          padding: "2.5rem 2rem",
          boxShadow: "0 10px 30px rgba(0,0,0,0.03)",
        }}
        role="img"
        aria-label="A 24-hour clock showing Clinchd's AI agent handling new leads, objections, and bookings throughout the day and night"
      >
        {/* Top metadata row */}
        <div className="flex items-center justify-between mb-8">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
            Live · Never offline
          </span>
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "#ff7e67" }}
            >
              24/7
            </span>
            <span
              className="relative block w-2 h-2 rounded-full"
              style={{ background: "#ff7e67" }}
            >
              <span
                className="ao-live-pulse absolute rounded-full"
                style={{
                  inset: "-4px",
                  background: "#ff7e67",
                  opacity: 0.4,
                }}
              />
            </span>
          </div>
        </div>

        {/* Dial container */}
        <div
          className="relative mx-auto"
          style={{
            width: "100%",
            maxWidth: `${RING_SIZE}px`,
            aspectRatio: "1",
          }}
        >
          {/* SVG ring + ticks */}
          <svg
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="#e7e5e4"
              strokeWidth="1"
            />

            {/* 24 tick marks */}
            {Array.from({ length: 24 }).map((_, i) => {
              const tickAngle = (i / 24) * 360 - 90;
              const tickRad = (tickAngle * Math.PI) / 180;
              const isMajor = i % 6 === 0;
              const innerR = isMajor ? RING_RADIUS - 10 : RING_RADIUS - 5;
              const outerR = RING_RADIUS;

              const x1 = RING_SIZE / 2 + Math.cos(tickRad) * innerR;
              const y1 = RING_SIZE / 2 + Math.sin(tickRad) * innerR;
              const x2 = RING_SIZE / 2 + Math.cos(tickRad) * outerR;
              const y2 = RING_SIZE / 2 + Math.sin(tickRad) * outerR;

              const tickProgress = i / 24;
              const isLit = orbitProgress >= tickProgress;

              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isLit ? "#ff7e67" : isMajor ? "#a8a29e" : "#d6d3d1"}
                  strokeWidth={isMajor ? "1.5" : "1"}
                  opacity={isLit ? 0.6 : 1}
                  style={{ transition: "stroke 0.3s ease-out" }}
                />
              );
            })}

            {/* 06 / 12 / 18 labels */}
            {[
              { angle: 0, label: "06" },
              { angle: 90, label: "12" },
              { angle: 180, label: "18" },
            ].map((m, i) => {
              const rad = (m.angle * Math.PI) / 180;
              const x = RING_SIZE / 2 + Math.cos(rad) * (RING_RADIUS + 22);
              const y = RING_SIZE / 2 + Math.sin(rad) * (RING_RADIUS + 22);
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  fontSize="10"
                  fontWeight="700"
                  fill="#a8a29e"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{
                    fontFamily: "'Satoshi', system-ui, sans-serif",
                    letterSpacing: "0.12em",
                  }}
                >
                  {m.label}
                </text>
              );
            })}
          </svg>

          {/* Orbiting coral dot — only shown when motion is allowed */}
          <div
            className="ao-orbit-dot absolute rounded-full pointer-events-none"
            style={{
              left: `${(dotX / RING_SIZE) * 100}%`,
              top: `${(dotY / RING_SIZE) * 100}%`,
              width: "12px",
              height: "12px",
              background: "#ff7e67",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 4px rgba(255, 126, 103, 0.18)",
            }}
          />

          {/* Center headline */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <h2
              className="text-stone-900 text-center m-0"
              style={{
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                fontSize: "32px",
                fontWeight: 900,
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
              }}
            >
              Always on.
              <br />
              Always responding.
            </h2>
            <p className="text-[12px] font-medium text-stone-500 mt-2 mb-0 text-center">
              Even at 3 AM
            </p>
          </div>

          {/* Notification pills */}
          {NOTIFICATIONS.map((notif) => {
            const rad = ((notif.angle - 90) * Math.PI) / 180;
            const pillRadius = RING_RADIUS + 70;
            const pillX = RING_SIZE / 2 + Math.cos(rad) * pillRadius;
            const pillY = RING_SIZE / 2 + Math.sin(rad) * pillRadius;
            const xPercent = (pillX / RING_SIZE) * 100;
            const yPercent = (pillY / RING_SIZE) * 100;
            const isRightSide = xPercent > 50;

            return (
              <div
                key={notif.id}
                id={`ao-pill-${notif.id}`}
                className="ao-pill absolute pointer-events-none whitespace-nowrap"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: isRightSide
                    ? "translate(0, -50%)"
                    : "translate(-100%, -50%)",
                }}
              >
                <div
                  className="inline-flex items-center gap-2 rounded-full"
                  style={{
                    padding: "0.4rem 0.8rem",
                    background: "#ffffff",
                    border: notif.accent
                      ? "1px solid rgba(255, 126, 103, 0.3)"
                      : "1px solid #e7e5e4",
                    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)",
                  }}
                >
                  {notif.accent && (
                    <span
                      className="block w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: "#ff7e67" }}
                    />
                  )}
                  <span
                    className="text-[10px] font-bold"
                    style={{
                      color: notif.accent ? "#ff7e67" : "#1c1917",
                      letterSpacing: "0.04em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {notif.time}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase text-stone-500"
                    style={{ letterSpacing: "0.1em" }}
                  >
                    {notif.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
