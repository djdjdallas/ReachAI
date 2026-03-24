import { Instagram, CreditCard, Calendar, Globe } from "lucide-react";

export default function TrustedBy() {
  return (
    <section className="py-20 bg-white border-y border-stone-100 reveal-up">
      <div className="max-w-7xl mx-auto px-4">
        <p className="text-center text-[12px] font-extrabold text-stone-400 uppercase tracking-[0.2em] mb-12">
          Trusted by 1,200+ Agencies &amp; Coaches
        </p>
        <div className="flex flex-wrap justify-center gap-16 md:gap-32 opacity-30 grayscale">
          <div className="flex items-center gap-2">
            <Globe className="w-9 h-9" />
            <span className="font-black text-2xl tracking-tighter">META</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-9 h-9" />
            <span className="font-black text-2xl tracking-tighter">CALENDLY</span>
          </div>
          <div className="flex items-center gap-2">
            <Instagram className="w-9 h-9" />
            <span className="font-black text-2xl tracking-tighter">INSTAGRAM</span>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-9 h-9" />
            <span className="font-black text-2xl tracking-tighter">STRIPE</span>
          </div>
        </div>
      </div>
    </section>
  );
}
