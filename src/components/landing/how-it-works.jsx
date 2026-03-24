import { Link2, FileEdit, ToggleRight, CalendarCheck } from "lucide-react";

const steps = [
  {
    icon: Link2,
    title: "Step 1 — Connect",
    description:
      "Link your Instagram Business account in one click via the official Meta Graph API. No passwords shared.",
    highlight: false,
  },
  {
    icon: FileEdit,
    title: "Step 2 — Script",
    description:
      "Tell Clinchd what you sell, who your ideal customer is, and how to handle objections. Takes 5 minutes.",
    highlight: false,
  },
  {
    icon: ToggleRight,
    title: "Step 3 — Activate",
    description:
      "Flip the switch. Every new DM gets read, qualified, and replied to in your voice — with a human-like delay so it never feels robotic.",
    highlight: false,
  },
  {
    icon: CalendarCheck,
    title: "Step 4 — Book",
    description:
      "When a lead is hot, Clinchd drops your Calendly link at exactly the right moment. You show up to pre-qualified calls.",
    highlight: true,
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 md:py-48 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-24 reveal-up">
          <div className="inline-flex items-center px-4 py-1 rounded-full bg-stone-100 text-stone-500 text-[11px] font-bold uppercase tracking-widest mb-6">
            Process
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight text-stone-900">
            From Instagram DM to booked call in under 10 minutes.
          </h2>
          <p className="text-stone-500 text-xl font-medium">
            A seamless 4-step workflow designed to save you 20+ hours a week.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 relative">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === steps.length - 1;
            return (
              <div key={step.title} className="relative group reveal-up">
                {!isLast && (
                  <div className="hidden md:block connector-line" />
                )}
                <div
                  className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-bold mb-8 group-hover:scale-110 transition-transform duration-300 relative z-10 ${
                    step.highlight
                      ? "bg-[#ff7e67] text-white shadow-xl shadow-[#ff7e67]/30"
                      : "bg-white shadow-sm border border-stone-100"
                  }`}
                >
                  <Icon
                    className={`w-7 h-7 ${
                      step.highlight ? "text-white" : "text-[#ff7e67]"
                    }`}
                  />
                </div>
                <h3
                  className={`text-xl font-black mb-4 ${
                    step.highlight ? "text-[#ff7e67]" : "text-stone-900"
                  }`}
                >
                  {step.title}
                </h3>
                <p className="text-stone-500 text-[15px] leading-relaxed font-medium">
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
