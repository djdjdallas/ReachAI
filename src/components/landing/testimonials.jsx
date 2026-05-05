import { Sparkles, Clock, Users } from "lucide-react";

const builtForCards = [
  {
    icon: Clock,
    title: "Replying in seconds, not hours",
    body:
      "We watched coaches lose discovery calls because their reply landed 6 hours after the lead's first DM. By morning, the urgency was gone. Clinchd answers in seconds, every timezone.",
  },
  {
    icon: Users,
    title: "Coaching-specific qualification",
    body:
      "Every objection script, qualifying question, and tone preset was designed around the patterns we saw across 200+ coach DM scripts. Built for $500 to $25K offers, not a generic chat builder.",
  },
  {
    icon: Sparkles,
    title: "Owner stays in control",
    body:
      "One-click human takeover, crisis-language detection, and human-in-the-loop oversight by default. The AI does the volume work; you handle the moments that need you.",
  },
];

export default function Testimonials() {
  return (
    <section id="why-clinchd" className="py-32 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center mb-16 reveal-up text-center">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-stone-900 text-white text-sm font-bold mb-4 shadow-xl">
            <Sparkles className="w-4 h-4 text-[#ff7e67]" />
            Early access
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
          <div className="lg:col-span-1 reveal-up">
            <h2 className="text-4xl font-black mb-8 leading-tight text-stone-900">
              Built for coaches selling $1K+ offers on Instagram.
            </h2>
            <p className="text-stone-500 text-lg font-medium mb-6">
              Clinchd was designed around the qualification patterns, objection handling, and timing decisions we saw across hundreds of real coach DM conversations.
            </p>
            <p className="text-stone-500 font-medium">
              Be among the first to see public results.
            </p>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-8">
            {builtForCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-white p-8 rounded-[2rem] soft-shadow border border-stone-50 reveal-up"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#fff5f2] text-[#ff7e67] mb-5">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-extrabold text-stone-900 mb-3 leading-tight">
                    {card.title}
                  </h3>
                  <p className="text-stone-500 text-sm leading-relaxed">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
