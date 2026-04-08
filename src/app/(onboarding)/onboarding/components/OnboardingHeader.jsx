"use client";

import { Zap, Check } from "lucide-react";

const STEP_LABELS = ["Connect", "Script", "Voice", "Preview", "Go Live"];

export default function OnboardingHeader({ currentStep }) {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 py-6 px-8 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#ff7e67] rounded-lg flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">ReachAI</span>
        </div>

        <div className="flex items-center gap-4">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isComplete = currentStep > stepNum;
            const isActive = currentStep === stepNum;

            return (
              <div key={label} className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm transition-all ${
                      isComplete
                        ? "bg-[#ff7e67] text-white"
                        : isActive
                        ? "bg-white border-2 border-[#ff7e67] text-[#ff7e67] ring-4 ring-[#fff5f2]"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {isComplete ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest ${
                      isActive
                        ? "text-[#ff7e67]"
                        : isComplete
                        ? "text-stone-500"
                        : "text-stone-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className="w-8 h-0.5 bg-stone-100" />
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden md:block">
          <button className="text-sm font-bold text-stone-400 hover:text-stone-900 transition-colors">
            Save &amp; Exit
          </button>
        </div>
      </div>
    </header>
  );
}
