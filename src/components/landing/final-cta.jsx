import Link from "next/link";
import { Rocket } from "lucide-react";

export default function FinalCta() {
  return (
    <section className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#fff5f2] rounded-[3.5rem] p-16 md:p-32 text-center relative overflow-hidden reveal-scale">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#ff7e67]/10 blur-[120px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#ff7e67]/5 blur-[120px] rounded-full" />

          <h2 className="text-4xl md:text-6xl font-black mb-12 max-w-3xl mx-auto leading-[1.1] tracking-tight text-stone-900 relative">
            Stop ghosting your best leads.{" "}
            <span className="text-[#ff7e67]">Start booking.</span>
          </h2>
          <div className="flex flex-col items-center gap-6 relative">
            <Link
              href="/signup"
              className="inline-flex items-center gap-3 bg-stone-900 text-white px-12 py-6 rounded-full text-xl font-black hover:bg-[#ff7e67] hover:scale-105 active:scale-95 transition-all shadow-2xl"
            >
              Get Started for Free
              <Rocket className="w-5 h-5" />
            </Link>
            <div className="flex flex-col gap-2">
              <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">
                7-day trial &middot; Setup in minutes
              </p>
              <p className="text-stone-400 font-medium text-xs italic">
                Setup takes 5 minutes. First reply sent today.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
