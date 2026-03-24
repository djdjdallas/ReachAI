import { TrendingUp, Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "I was manually responding to 80+ DMs a day. ReachAI handles all of it now. I woke up to 3 booked calls on my first morning.",
    name: "Sarah Jenkins",
    role: "Sales Coach, 12k followers",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
  },
  {
    quote:
      "I was skeptical an AI could handle my objections. It handles them better than I do. 20 minutes setup, money back in 4 days.",
    name: "Marcus Thorne",
    role: "Agency Owner, 25k followers",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
  },
  {
    quote:
      "The human-like delay is the game changer. People think they're talking to my assistant. Highest ROI tool I've ever bought.",
    name: "Emma Rivera",
    role: "Business Coach, 8k followers",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emma",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-32 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center mb-16 reveal-up">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-stone-900 text-white text-sm font-bold mb-4 shadow-xl">
            <TrendingUp className="w-4 h-4 text-[#ff7e67]" />
            847 calls booked this month
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-1 reveal-up">
            <h2 className="text-4xl font-black mb-8 leading-tight text-stone-900">
              Loved by the world&apos;s best closers.
            </h2>
            <p className="text-stone-500 text-lg font-medium mb-8">
              Real results from real operators. 4.9/5 from 800+ reviews.
            </p>
            <div className="flex items-center gap-1.5 text-[#ff7e67] mb-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-[#ff7e67]" />
              ))}
            </div>
            <p className="text-sm font-extrabold text-stone-400 uppercase tracking-widest">
              Market Leader
            </p>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white p-8 rounded-[2rem] soft-shadow border border-stone-50 reveal-up"
              >
                <p className="text-stone-700 font-medium text-base italic mb-8 leading-relaxed">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.avatar}
                    className="w-12 h-12 rounded-full bg-[#fff5f2] border-2 border-[#ff7e67]/20"
                    alt={t.name}
                  />
                  <div>
                    <h5 className="font-black text-stone-900">{t.name}</h5>
                    <p className="text-[11px] text-stone-400 font-bold uppercase tracking-wider leading-none">
                      {t.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
