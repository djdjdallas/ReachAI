import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function CTABanner({
  headline = "Ready to handle your DMs with AI assistance?",
  subheadline = "Start your 7-day free trial — no credit card required.",
  buttonText = "Start Free Trial",
  buttonHref = "/signup",
  variant = "dark",
}) {
  const isDark = variant === "dark";

  return (
    <section
      className={`relative overflow-hidden rounded-[2.5rem] px-8 py-16 md:px-16 md:py-20 text-center ${
        isDark
          ? "bg-stone-900 text-white"
          : "bg-[#fff5f2] text-stone-900"
      }`}
    >
      <div
        className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-[120px] ${
          isDark ? "bg-[#ff7e67]/20" : "bg-[#ff7e67]/10"
        }`}
      />
      <div
        className={`absolute -bottom-24 -left-24 w-96 h-96 rounded-full blur-[120px] ${
          isDark ? "bg-[#ff7e67]/10" : "bg-[#ff7e67]/5"
        }`}
      />

      <div className="relative z-10 max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-4">
          {headline}
        </h2>
        <p
          className={`text-lg font-medium mb-8 ${
            isDark ? "text-stone-300" : "text-stone-500"
          }`}
        >
          {subheadline}
        </p>
        <Link
          href={buttonHref}
          className="inline-flex items-center gap-2 bg-[#ff7e67] text-white px-8 py-4 rounded-full text-lg font-bold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff7e67]/30 group"
        >
          {buttonText}
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </section>
  );
}
