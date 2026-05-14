"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

export default function OnboardingFooter({
  onBack,
  onPrimary,
  primaryLabel = "Continue",
  primaryDisabled = false,
  primaryLoading = false,
  primaryIcon: PrimaryIcon = ArrowRight,
  primaryTooltip,
  onSkip,
  skipLabel = "Skip for now",
  completion,
  enableEnterKey = true,
  backLabel = "Previous Step",
}) {
  const primaryRef = useRef(onPrimary);
  const disabledRef = useRef(primaryDisabled || primaryLoading);

  useEffect(() => {
    primaryRef.current = onPrimary;
  }, [onPrimary]);

  useEffect(() => {
    disabledRef.current = primaryDisabled || primaryLoading;
  }, [primaryDisabled, primaryLoading]);

  useEffect(() => {
    if (!enableEnterKey) return;
    const handler = (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "textarea") return;
      if (tag === "input") {
        const type = (target.type || "").toLowerCase();
        if (type === "url" || type === "email" || type === "search") return;
      }
      if (target?.isContentEditable) return;
      if (disabledRef.current) return;
      if (typeof primaryRef.current !== "function") return;
      e.preventDefault();
      primaryRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enableEnterKey]);

  const isDisabled = primaryDisabled || primaryLoading;

  return (
    <footer className="bg-white border-t border-stone-200 py-6 px-6 sticky bottom-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        {/* Back link (left) */}
        <div className="flex justify-center sm:justify-start">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-2 text-stone-400 hover:text-stone-900 font-bold text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {backLabel}
            </button>
          ) : (
            <span className="hidden sm:block" aria-hidden="true" />
          )}
        </div>

        {/* Completion indicator (center) */}
        {completion ? (
          <div className="hidden md:flex flex-col items-center">
            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
              Completion
            </div>
            <div className="text-sm font-black">{completion}</div>
          </div>
        ) : null}

        {/* Skip + Primary (right). On mobile, primary stacks above skip. */}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4 sm:justify-end">
          {onSkip ? (
            <button
              type="button"
              onClick={onSkip}
              className="text-sm font-bold text-stone-400 hover:text-stone-700 transition-colors px-2 py-2 sm:py-0"
            >
              {skipLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            disabled={isDisabled}
            title={isDisabled ? primaryTooltip : undefined}
            className={`px-10 py-4 rounded-full font-black text-lg transition-all flex items-center justify-center gap-3 ${
              isDisabled
                ? "bg-stone-200 text-stone-400 cursor-not-allowed shadow-none"
                : "bg-[#ff7e67] text-white shadow-xl shadow-[#ff7e67]/20 hover:scale-105 active:scale-95 cursor-pointer"
            }`}
          >
            {primaryLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            {primaryLabel}
            {!primaryLoading && PrimaryIcon ? (
              <PrimaryIcon className="w-5 h-5" />
            ) : null}
          </button>
        </div>
      </div>
    </footer>
  );
}
