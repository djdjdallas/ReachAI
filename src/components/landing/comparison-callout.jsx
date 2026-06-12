import Link from "next/link";
import { ArrowRight } from "lucide-react";

const rows = [
  { feature: "Cost", setter: "$2,000 to $4,000 / month", clinchd: "$97 / month" },
  { feature: "Hours", setter: "Sleeps, eats, takes days off", clinchd: "Answers every hour" },
  { feature: "Ramp time", setter: "2 to 3 weeks to hit KPI", clinchd: "Live in minutes" },
  { feature: "Consistency", setter: "Good days and off days", clinchd: "Same quality every reply" },
  { feature: "Your voice", setter: "Approximates it", clinchd: "Trained on your tone and offer" },
  { feature: "Conversations at once", setter: "One", clinchd: "As many as come in" },
];

export default function ComparisonCallout() {
  return (
    <section className="py-24 md:py-32 bg-[#fafaf9]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 reveal-up">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-900 mb-6">
            The math on a human setter
          </h2>
          <p className="text-stone-500 text-lg font-medium max-w-2xl mx-auto">
            You keep the relationship, the account, and the control. Clinchd just
            makes sure nobody waits.
          </p>
        </div>

        <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow reveal-up">
          <div className="grid grid-cols-3 text-center border-b border-stone-100">
            <div className="py-5 px-4 text-sm font-bold text-stone-400 uppercase tracking-wider" />
            <div className="py-5 px-4 text-sm font-bold text-stone-400 uppercase tracking-wider border-x border-stone-100">
              Human setter
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
                {row.setter}
              </div>
              <div className="py-4 px-4 text-sm font-semibold text-stone-900 bg-[#fff5f2]/30">
                {row.clinchd}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-3xl mx-auto reveal-up">
          <p className="text-center text-stone-500 font-medium leading-relaxed">
            Clinchd handles qualifying and booking. You still close the call.
            That&apos;s the part only you can do.
          </p>
        </div>

        <div className="text-center mt-10 reveal-up">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 text-[#ff7e67] font-bold text-lg hover:gap-3 transition-all group"
          >
            See it on your own offer
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
}
