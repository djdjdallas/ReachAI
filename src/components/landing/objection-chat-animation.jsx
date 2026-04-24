"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Instagram } from "lucide-react";
import { objections } from "@/lib/objections";

gsap.registerPlugin(ScrollTrigger);

export default function ObjectionChatAnimation() {
  const containerRef = useRef(null);
  const leadRefs = useRef([]);
  const clinchdRefs = useRef([]);
  const typingRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const ctx = gsap.context(() => {
      gsap.set(typingRef.current, { opacity: 0, y: 10 });
      gsap.set([...leadRefs.current, ...clinchdRefs.current], {
        opacity: 0,
        y: 20,
        scale: 0.95,
      });

      if (reduceMotion) {
        gsap.set([...leadRefs.current, ...clinchdRefs.current], {
          opacity: 1,
          y: 0,
          scale: 1,
        });
        return;
      }

      const tl = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.4,
        paused: true,
      });

      objections.forEach((_, i) => {
        const lead = leadRefs.current[i];
        const clinchd = clinchdRefs.current[i];
        const typing = typingRef.current;

        tl.addLabel(`step-${i}`)
          .call(() => setActiveIndex(i), null, `step-${i}`)
          .to(
            lead,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.45,
              ease: "back.out(1.4)",
            },
            `step-${i}`
          )
          .to(typing, { opacity: 1, y: 0, duration: 0.25 }, "+=0.5")
          .to(typing, { opacity: 0, y: -6, duration: 0.2 }, "+=1.1")
          .to(
            clinchd,
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.45,
              ease: "back.out(1.4)",
            },
            "+=0.05"
          )
          .to(
            [lead, clinchd],
            {
              opacity: 0,
              y: -12,
              duration: 0.4,
              ease: "power2.in",
            },
            "+=2.8"
          )
          .set([lead, clinchd], { y: 20, scale: 0.95 });
      });

      ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top 80%",
        end: "bottom 20%",
        onEnter: () => tl.play(),
        onEnterBack: () => tl.play(),
        onLeave: () => tl.pause(),
        onLeaveBack: () => tl.pause(),
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className="max-w-md mx-auto mb-16 reveal-up">
      <div className="rounded-[2rem] bg-white soft-shadow border border-stone-100 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff7e67] to-[#f43f5e] flex items-center justify-center text-white">
            <Instagram className="w-4 h-4" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-stone-900 leading-tight">
              sarah_fitness
            </div>
            <div className="text-[11px] text-stone-400 font-medium">
              Active now · Instagram DM
            </div>
          </div>
          <div className="w-2 h-2 rounded-full bg-green-500" />
        </div>

        <div className="relative px-5 py-6 min-h-[360px]">
          {objections.map((item, i) => (
            <div
              key={`lead-${i}`}
              ref={(el) => {
                leadRefs.current[i] = el;
              }}
              className="absolute top-6 left-5 right-16"
              style={{ willChange: "transform, opacity" }}
            >
              <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-2.5">
                <p className="text-[15px] text-stone-900 leading-snug">
                  {item.objection}
                </p>
              </div>
            </div>
          ))}

          <div
            ref={typingRef}
            className="absolute left-5 top-[100px]"
            style={{ willChange: "transform, opacity" }}
          >
            <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-stone-100 px-4 py-3">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
                style={{ animationDelay: "0.15s" }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
                style={{ animationDelay: "0.3s" }}
              />
            </div>
          </div>

          {objections.map((item, i) => (
            <div
              key={`clinchd-${i}`}
              ref={(el) => {
                clinchdRefs.current[i] = el;
              }}
              className="absolute top-[150px] left-16 right-5 flex justify-end"
              style={{ willChange: "transform, opacity" }}
            >
              <div className="inline-block max-w-full rounded-2xl rounded-tr-sm bg-[#ff7e67] px-4 py-2.5">
                <p className="text-[15px] text-white leading-snug font-medium">
                  {item.shortClinchd}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 pb-5">
          {objections.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-6 bg-[#ff7e67]"
                  : "w-1.5 bg-stone-200"
              }`}
            />
          ))}
        </div>
      </div>

      <p className="text-center text-[13px] text-stone-400 font-medium mt-4">
        Live demo · Clinchd replies in your voice
      </p>
    </div>
  );
}
