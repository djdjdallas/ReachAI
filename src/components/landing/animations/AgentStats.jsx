"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * AgentStats — Clinchd homepage animation for "AI Agent Performance"
 * Replaces /animations/06-analytics-dashboard.mp4
 *
 * BEHAVIOR: Animates ONCE when scrolled into view (using GSAP ScrollTrigger,
 * already registered in src/components/landing/gsap-provider.jsx). Real
 * analytics dashboards don't loop, so we don't either.
 *
 * Entry timing (~3.5s):
 *   Beat 1 (0.0s):   Card fades in
 *   Beat 2 (0.4s):   KPI numbers count up from 0 to final values (~1.8s)
 *   Beat 3 (0.9s):   Line chart draws in via strokeDashoffset (2.2s)
 *   Beat 4 (1.4s):   Progress ring fills 0% → 54% (1.8s)
 *   Beat 5 (3.5s):   Coral pulse on chart's last data point (ambient, infinite)
 *
 * Honors prefers-reduced-motion: shows final state immediately.
 *
 * Uses the existing `gsap` package — no new dependencies.
 */

const FINAL = {
  totalConversations: 847,
  callsBooked: 124,
  avgResponse: 11,
  qualificationRate: 34,
  bookingRate: 54,
};

const CHART_DATA = [0.18, 0.28, 0.32, 0.45, 0.55, 0.74, 0.92];

export default function AgentStats() {
  const rootRef = useRef(null);
  const [ringProgress, setRingProgress] = useState(0); // 0..1, drives ring fill
  const [counters, setCounters] = useState({
    totalConversations: 0,
    callsBooked: 0,
    avgResponse: 0,
    qualificationRate: 0,
  });
  const [pathLength, setPathLength] = useState(2000);
  const pathRef = useRef(null);

  // Measure SVG path length once on mount (needed for stroke-dasharray draw-in)
  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // Skip to final state
      setCounters({
        totalConversations: FINAL.totalConversations,
        callsBooked: FINAL.callsBooked,
        avgResponse: FINAL.avgResponse,
        qualificationRate: FINAL.qualificationRate,
      });
      setRingProgress(1);
      gsap.set(".as-card", { opacity: 1, y: 0 });
      gsap.set(".as-chart-path", { strokeDashoffset: 0 });
      gsap.set(".as-chart-fill", { opacity: 1 });
      gsap.set(".as-chart-dot", { opacity: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      // Initial states
      gsap.set(".as-card", { opacity: 0, y: 12 });
      gsap.set(".as-chart-path", { strokeDashoffset: pathLength });
      gsap.set(".as-chart-fill", { opacity: 0 });
      gsap.set(".as-chart-dot", { opacity: 0, scale: 0.6 });

      // Build a one-shot timeline triggered on scroll
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: rootRef.current,
          start: "top 80%",
          once: true,
          // Tip: set markers: true while debugging entry trigger position
        },
        defaults: { ease: "power2.out" },
      });

      // Beat 1: Card fades in
      tl.to(".as-card", { opacity: 1, y: 0, duration: 0.5 });

      // Beat 2: KPI counters tick up
      // Use a proxy object that GSAP can tween, then read values into React state
      const counterProxy = {
        totalConversations: 0,
        callsBooked: 0,
        avgResponse: 0,
        qualificationRate: 0,
      };

      tl.to(
        counterProxy,
        {
          totalConversations: FINAL.totalConversations,
          callsBooked: FINAL.callsBooked,
          avgResponse: FINAL.avgResponse,
          qualificationRate: FINAL.qualificationRate,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: () => {
            setCounters({
              totalConversations: Math.round(counterProxy.totalConversations),
              callsBooked: Math.round(counterProxy.callsBooked),
              avgResponse: Math.round(counterProxy.avgResponse),
              qualificationRate: Math.round(counterProxy.qualificationRate),
            });
          },
        },
        0.4
      );

      // Beat 3: Line chart draws in
      tl.to(
        ".as-chart-path",
        {
          strokeDashoffset: 0,
          duration: 2.2,
          ease: "power2.out",
        },
        0.9
      );

      // Chart fill fades in slightly behind the line
      tl.to(
        ".as-chart-fill",
        { opacity: 1, duration: 0.8 },
        2.4
      );

      // Beat 4: Progress ring fills (driven via React state for the center number)
      const ringProxy = { v: 0 };
      tl.to(
        ringProxy,
        {
          v: 1,
          duration: 1.8,
          ease: "power2.out",
          onUpdate: () => setRingProgress(ringProxy.v),
        },
        1.4
      );

      // Beat 5: Chart dot appears + ambient pulse begins
      tl.to(
        ".as-chart-dot",
        { opacity: 1, scale: 1, duration: 0.4 },
        3.0
      );

      // Independent ambient loops (set up regardless of trigger state — safe,
      // just animates between values that the dot has whether visible or not)
      gsap.to(".as-chart-dot-pulse", {
        scale: 1.8,
        opacity: 0,
        duration: 1.8,
        ease: "sine.out",
        repeat: -1,
        delay: 3.5,
      });

      gsap.to(".as-live-pulse", {
        scale: 1.8,
        opacity: 0,
        duration: 1.5,
        ease: "sine.out",
        repeat: -1,
      });
    }, rootRef);

    return () => ctx.revert();
  }, [pathLength]);

  return (
    <div ref={rootRef} className="w-full">
      <div
        className="as-card bg-white border border-stone-200 rounded-[2rem] p-6 md:p-8"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }}
        role="img"
        aria-label="AI agent performance dashboard"
      >
        {/* Top metarow */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500 mb-1">
              Last 30 days · Live
            </div>
            <h3
              className="text-stone-900 m-0"
              style={{
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                fontSize: "22px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              Your AI Agent Performance
            </h3>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: "#ff7e67" }}
            >
              Live
            </span>
            <span
              className="relative block w-2 h-2 rounded-full"
              style={{ background: "#ff7e67" }}
            >
              <span
                className="as-live-pulse absolute rounded-full"
                style={{
                  inset: "-4px",
                  background: "#ff7e67",
                  opacity: 0.4,
                }}
              />
            </span>
          </div>
        </div>

        {/* KPI grid + ring */}
        <div className="flex flex-wrap gap-6 items-stretch">
          <div className="flex-1 min-w-[480px] grid grid-cols-2 gap-4">
            <KpiTile
              label="Total Conversations"
              value={counters.totalConversations}
            />
            <KpiTile
              label="Calls Booked"
              value={counters.callsBooked}
              accent
            />
            <KpiTile
              label="Avg Response"
              value={counters.avgResponse}
              suffix="s"
            />
            <KpiTile
              label="Qualification Rate"
              value={counters.qualificationRate}
              suffix="%"
            />
          </div>

          <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 200 }}>
            <ProgressRing target={FINAL.bookingRate} progress={ringProgress} />
          </div>
        </div>

        {/* Chart */}
        <div className="mt-7 pt-6" style={{ borderTop: "1px solid #f5f5f4" }}>
          <div className="flex items-center justify-between mb-3.5 px-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
              Conversations · Last 7 weeks
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{
                color: "#ff7e67",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              +127% ↗
            </span>
          </div>
          <ChartSvg
            data={CHART_DATA}
            pathRef={pathRef}
            pathLength={pathLength}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   KPI Tile
   ───────────────────────────────────────────────────────────── */

function KpiTile({ label, value, suffix = "", accent }) {
  return (
    <div
      className="rounded-[1.25rem] p-5"
      style={{
        background: accent ? "#fff5f2" : "#fafaf9",
        border: accent
          ? "1px solid rgba(255, 126, 103, 0.25)"
          : "1px solid #f5f5f4",
      }}
    >
      <div
        className="text-[10px] font-bold uppercase mb-2"
        style={{
          letterSpacing: "0.12em",
          color: accent ? "#ff7e67" : "#a8a29e",
        }}
      >
        {label}
      </div>
      <div
        className="text-stone-900"
        style={{
          fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
          fontSize: "44px",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
        <span style={{ fontSize: "0.6em", marginLeft: "1px" }}>{suffix}</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ProgressRing — driven by `progress` prop (0..1)
   ───────────────────────────────────────────────────────────── */

function ProgressRing({ target, progress }) {
  const SIZE = 180;
  const STROKE = 8;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const displayValue = Math.round(target * progress);
  const dashOffset =
    CIRCUMFERENCE - CIRCUMFERENCE * (target / 100) * progress;

  return (
    <div className="relative" style={{ width: SIZE, height: SIZE }}>
      <svg
        width={SIZE}
        height={SIZE}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#f5f5f4"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#ff7e67"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="text-stone-900"
          style={{
            fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
            fontSize: "36px",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {displayValue}
          <span style={{ fontSize: "0.6em" }}>%</span>
        </div>
        <div
          className="text-[10px] font-bold uppercase mt-1 text-center"
          style={{
            letterSpacing: "0.12em",
            color: "#78716c",
            maxWidth: "120px",
          }}
        >
          Booking Rate
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   ChartSvg — line chart with strokeDashoffset draw-in
   ───────────────────────────────────────────────────────────── */

function ChartSvg({ data, pathRef, pathLength }) {
  const WIDTH = 1000;
  const HEIGHT = 140;
  const PADDING_X = 12;
  const PADDING_Y = 14;

  const points = data.map((v, i) => ({
    x:
      PADDING_X +
      (i * (WIDTH - PADDING_X * 2)) / (data.length - 1),
    y: PADDING_Y + (1 - v) * (HEIGHT - PADDING_Y * 2),
  }));

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = p0.x + (p1.x - p0.x) / 2;
    path += ` C ${cpx},${p0.y} ${cpx},${p1.y} ${p1.x},${p1.y}`;
  }

  const lastPoint = points[points.length - 1];
  const fillPath = `${path} L ${lastPoint.x},${HEIGHT - PADDING_Y} L ${
    points[0].x
  },${HEIGHT - PADDING_Y} Z`;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height: "140px" }}
      >
        {/* Dotted baseline */}
        <line
          x1={PADDING_X}
          y1={HEIGHT - PADDING_Y}
          x2={WIDTH - PADDING_X}
          y2={HEIGHT - PADDING_Y}
          stroke="#e7e5e4"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        <defs>
          <linearGradient id="agentChartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7e67" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ff7e67" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={fillPath} fill="url(#agentChartFill)" className="as-chart-fill" />

        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="#ff7e67"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="as-chart-path"
          strokeDasharray={pathLength}
        />
      </svg>

      {/* Pulsing dot at last point */}
      <span
        className="as-chart-dot absolute"
        style={{
          right: `${(PADDING_X / WIDTH) * 100}%`,
          top: `${
            ((PADDING_Y + (1 - data[data.length - 1]) * (HEIGHT - PADDING_Y * 2)) /
              HEIGHT) *
            100
          }%`,
          width: "10px",
          height: "10px",
          borderRadius: "9999px",
          background: "#ff7e67",
          transform: "translate(50%, -50%)",
          boxShadow: "0 0 0 4px rgba(255, 126, 103, 0.18)",
          pointerEvents: "none",
        }}
      >
        <span
          className="as-chart-dot-pulse absolute rounded-full"
          style={{
            inset: "-4px",
            background: "#ff7e67",
            opacity: 0.4,
          }}
        />
      </span>
    </div>
  );
}
