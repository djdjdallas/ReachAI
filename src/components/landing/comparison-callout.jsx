import Link from "next/link";
import { ArrowRight, Check, X, Minus } from "lucide-react";

const rows = [
  { feature: "Setup time", manychat: "5+ hours", clinchd: "Under 30 minutes" },
  { feature: "Pricing", manychat: "Per contact (scales up)", clinchd: "Flat $97/month" },
  { feature: "AI quality", manychat: "Rule-based flows", clinchd: "True AI conversations" },
  { feature: "Instagram-native", manychat: "Adapted from Messenger", clinchd: "Built for Instagram" },
  { feature: "Designed for coaches", manychat: "Generic platform", clinchd: "100% coach-focused" },
];

export default function ComparisonCallout() {
  return (
    <section className="py-24 md:py-32 bg-[#fafaf9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal-up">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-900 mb-6">
            Why coaches switch from ManyChat to Clinchd
          </h2>
          <p className="text-stone-500 text-lg font-medium max-w-2xl mx-auto">
            ManyChat is built for everyone. Clinchd is built for you.
          </p>
        </div>

        <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow reveal-up">
          <div className="grid grid-cols-3 text-center border-b border-stone-100">
            <div className="py-5 px-4 text-sm font-bold text-stone-400 uppercase tracking-wider">
              Feature
            </div>
            <div className="py-5 px-4 text-sm font-bold text-stone-400 uppercase tracking-wider border-x border-stone-100">
              ManyChat
            </div>
            <div className="py-5 px-4 text-sm font-bold text-[#ff7e67] uppercase tracking-wider bg-[#fff5f2]">
              Clinchd
            </div>
          </div>

          {rows.map((row, i) => (
            <div
              key={row.feature}
              className={`grid grid-cols-3 text-center ${
                i < rows.length - 1 ? "border-b border-stone-50" : ""
              }`}
            >
              <div className="py-4 px-4 text-sm font-bold text-stone-900 text-left pl-6">
                {row.feature}
              </div>
              <div className="py-4 px-4 text-sm text-stone-400 border-x border-stone-50">
                {row.manychat}
              </div>
              <div className="py-4 px-4 text-sm font-semibold text-stone-900 bg-[#fff5f2]/30">
                {row.clinchd}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 reveal-up">
          <Link
            href="/compare/vs-manychat"
            className="inline-flex items-center gap-2 text-[#ff7e67] font-bold text-lg hover:gap-3 transition-all group"
          >
            See the full comparison
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
