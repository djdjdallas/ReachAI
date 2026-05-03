"use client";

import { useEffect, useRef, useState, useMemo, Fragment } from "react";

const FONT = "'Cabinet Grotesk', system-ui, sans-serif";
const BORDER = "#e7e5e4";
const GRAY_BUBBLE_BG = "#ffffff";
const GRAY_TEXT = "#1c1917";
const CORAL = "#ff7e67";
const CORAL_TINT = "#fff5f2";

const SCRIPT = [
  { side: "in", text: "Hey, do you take 1:1 clients?" },
  {
    side: "out",
    text:
      "Yes! Taking on 3 new clients this month. What are you working on right now?",
  },
  { side: "in", text: "Trying to scale my coaching biz past 10k a month" },
  {
    side: "out",
    text: "Love that. Are you currently running ads or growing organically?",
  },
  { side: "in", text: "Mostly organic, IG and a bit of YouTube" },
  {
    side: "out",
    text:
      "Perfect. I help coaches in your spot hit 20-30k. Want to hop on a quick call this week to map it out?",
  },
];

const STREAM_SPEED = 28;
const TYPING_DUR = 0.4;
const GAP_BETWEEN = 0.6;
const END_HOLD = 1.0;
const BUBBLE_FONT_SIZE = 15;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function buildSchedule(script) {
  const POP_DUR = 0.32;
  const READ_PER_CHAR = 0.022;
  const READ_BASE = 0.45;
  const STREAM_PER_CHAR = STREAM_SPEED / 1000;

  const items = [];
  let t = 0.2;

  for (let i = 0; i < script.length; i++) {
    const msg = script[i];
    if (msg.side === "in") {
      const typingStart = t;
      const typingEnd = t + TYPING_DUR;
      const popStart = typingEnd;
      const popEnd = popStart + POP_DUR;
      const readEnd =
        popEnd + READ_BASE + msg.text.length * READ_PER_CHAR * 0.6;
      items.push({
        ...msg,
        idx: i,
        typingStart,
        typingEnd,
        popStart,
        popEnd,
        streamStart: null,
        streamEnd: null,
        end: readEnd,
      });
      t = readEnd + GAP_BETWEEN;
    } else {
      const popStart = t;
      const popEnd = popStart + POP_DUR;
      const streamStart = popStart + 0.08;
      const streamEnd = streamStart + msg.text.length * STREAM_PER_CHAR;
      const end = streamEnd + 0.25;
      items.push({
        ...msg,
        idx: i,
        typingStart: null,
        typingEnd: null,
        popStart,
        popEnd,
        streamStart,
        streamEnd,
        end,
      });
      t = end + GAP_BETWEEN;
    }
  }
  return items;
}

function useLoopTime(duration) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    let raf;
    let start = null;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setTime(duration);
      return;
    }
    const tick = (ts) => {
      if (start == null) start = ts;
      const elapsed = (ts - start) / 1000;
      setTime(elapsed % duration);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return time;
}

function Bubble({ msg, time }) {
  const isIn = msg.side === "in";

  const popLocal = clamp(
    (time - msg.popStart) / (msg.popEnd - msg.popStart),
    0,
    1
  );
  if (popLocal <= 0) return null;
  const eased = easeOutBack(popLocal);
  const opacity = clamp(popLocal * 1.4, 0, 1);
  const ty = (1 - eased) * 6;
  const scale = 0.92 + 0.08 * eased;

  let displayed = msg.text;
  let streaming = false;
  if (msg.side === "out" && msg.streamStart != null) {
    if (time < msg.streamStart) {
      displayed = "";
    } else if (time < msg.streamEnd) {
      const elapsed = time - msg.streamStart;
      const total = msg.streamEnd - msg.streamStart;
      const chars = Math.floor((elapsed / total) * msg.text.length);
      displayed = msg.text.slice(0, chars);
      streaming = true;
    }
  }

  const caretOn = streaming && Math.floor(time * 2.8) % 2 === 0;

  const common = {
    maxWidth: 250,
    padding: "11px 15px",
    fontFamily: FONT,
    fontWeight: 500,
    fontSize: BUBBLE_FONT_SIZE,
    lineHeight: 1.35,
    letterSpacing: "-0.005em",
    opacity,
    transform: `translateY(${ty}px) scale(${scale})`,
    willChange: "transform, opacity",
    minHeight: 18,
  };

  if (isIn) {
    return (
      <div
        style={{
          ...common,
          alignSelf: "flex-start",
          background: GRAY_BUBBLE_BG,
          color: GRAY_TEXT,
          border: `1px solid ${BORDER}`,
          borderRadius: "20px 20px 20px 6px",
          transformOrigin: "left top",
        }}
      >
        {msg.text}
      </div>
    );
  }

  return (
    <div
      style={{
        ...common,
        alignSelf: "flex-end",
        background: CORAL,
        color: "#ffffff",
        borderRadius: "20px 20px 6px 20px",
        transformOrigin: "right top",
        boxShadow: `0 1px 2px ${CORAL}33`,
      }}
    >
      {displayed}
      {streaming && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: "0.95em",
            background: "#ffffff",
            marginLeft: 1,
            verticalAlign: "-0.12em",
            opacity: caretOn ? 0.9 : 0,
            transition: "opacity 60ms linear",
          }}
        />
      )}
    </div>
  );
}

function TypingIndicator({ msg, time }) {
  if (msg.side !== "in" || msg.typingStart == null) return null;
  if (time < msg.typingStart || time > msg.typingEnd) return null;

  const local = time - msg.typingStart;
  const span = msg.typingEnd - msg.typingStart;
  const entry = clamp(local / Math.min(0.18, span * 0.4), 0, 1);
  const exit = clamp((local - (span - 0.14)) / 0.14, 0, 1);
  const eEased = easeOutBack(entry);
  const opacity = entry * (1 - exit);
  const scale = (0.85 + 0.15 * eEased) * (1 - 0.1 * exit);
  const ty = (1 - eEased) * 5;

  const dot = (phase) => {
    const tt = (local * 1.8 + phase) % 1;
    const v = 0.5 - 0.5 * Math.cos(tt * Math.PI * 2);
    return {
      opacity: 0.35 + 0.55 * v,
      transform: `scale(${0.85 + 0.25 * v})`,
    };
  };

  return (
    <div
      style={{
        alignSelf: "flex-start",
        padding: "12px 14px",
        background: CORAL_TINT,
        borderRadius: "20px 20px 20px 6px",
        display: "flex",
        alignItems: "center",
        gap: 5,
        opacity,
        transform: `translateY(${ty}px) scale(${scale})`,
        transformOrigin: "left top",
        willChange: "transform, opacity",
      }}
    >
      {[0, 0.18, 0.36].map((phase, i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            background: CORAL,
            transformOrigin: "center",
            ...dot(phase),
          }}
        />
      ))}
    </div>
  );
}

function MessageList({ items, time }) {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let raf;
    const tick = () => {
      const c = containerRef.current;
      const inner = innerRef.current;
      if (c && inner) {
        const innerH = inner.scrollHeight;
        const cs = getComputedStyle(c);
        const padT = parseFloat(cs.paddingTop) || 0;
        const padB = parseFloat(cs.paddingBottom) || 0;
        const availH = c.clientHeight - padT - padB;
        const overflow = Math.max(0, innerH - availH);
        setScrollY((prev) => {
          const next = prev + (overflow - prev) * 0.18;
          return Math.abs(next - overflow) < 0.3 ? overflow : next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        padding: "20px 16px 18px",
        overflow: "hidden",
      }}
    >
      <div
        ref={innerRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 9,
          transform: `translateY(-${scrollY}px)`,
          willChange: "transform",
        }}
      >
        {items.map((msg) => {
          const visible = time >= msg.popStart - 0.02;
          return (
            <Fragment key={msg.idx}>
              {visible && <Bubble msg={msg} time={time} />}
              <TypingIndicator msg={msg} time={time} />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function DMConversation() {
  const schedule = useMemo(() => buildSchedule(SCRIPT), []);
  const totalDur = schedule[schedule.length - 1].end + END_HOLD;
  const time = useLoopTime(totalDur);

  const entry = clamp(time / 0.3, 0, 1);
  const eased = easeOutCubic(entry);
  const ty = (1 - eased) * 6;

  return (
    <div
      role="img"
      aria-label="Demonstration of Clinchd AI qualifying a coaching lead and booking a discovery call over Instagram DMs"
      className="w-full mx-auto"
      style={{
        maxWidth: 340,
        aspectRatio: "340 / 460",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: eased,
          transform: `translateY(${ty}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#ffffff",
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.02), 0 8px 24px rgba(0,0,0,0.04)",
          }}
        >
          <MessageList items={schedule} time={time} />
        </div>
      </div>
    </div>
  );
}
