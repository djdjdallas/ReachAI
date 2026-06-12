import { Check, X } from "lucide-react";

/**
 * WhoItsFor — the wedge section.
 *
 * Converts the enterprise done-for-you "$50k/mo minimum" gate into Clinchd's
 * reason to exist. No competitor is named; the contrast is drawn against the
 * generic "done-for-you tools" and the human-setter cost.
 *
 * This is the most important new block on the page — it tells the coach who
 * gets rejected by the gatekeepers that they're exactly who this is for.
 */

const notYou = [
  "Doing $50k a month, or you don't qualify",
  "Fill out the form, then book a call to hear the price",
  "Wait for a team to build your “clone”",
];

const isYou = [
  "5,000 to 100,000 followers with an offer worth $1k+",
  "More DMs than time, losing real money to slow replies",
  "Sign up, connect Instagram, get answered today",
];

export default function WhoItsFor() {
  return (
    <section className="py-24 md:py-32 bg-[#fff5f2]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6 border border-[#ff7e67]/15">
            The wedge
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-stone-900 leading-[1.05]">
            Built for the coach who{" "}
            <span className="text-[#ff7e67]">actually needs this.</span>
          </h2>
          <p className="text-stone-600 text-lg md:text-xl font-medium leading-relaxed">
            The big done-for-you tools have a minimum. Fill out the form, book the
            call, wait for a team to build your clone. That&apos;s not you, and
            that&apos;s fine.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto reveal-up">
          {/* Not you */}
          <div className="bg-white rounded-[2rem] border border-stone-100 p-8 md:p-10 soft-shadow">
            <div className="text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-6">
              The enterprise gate
            </div>
            <ul className="space-y-4">
              {notYou.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-stone-400" />
                  </span>
                  <span className="text-stone-500 font-medium leading-snug">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Is you */}
          <div className="bg-stone-900 text-white rounded-[2rem] p-8 md:p-10 relative overflow-hidden soft-shadow">
            <div className="absolute -right-16 -top-16 w-56 h-56 bg-[#ff7e67]/20 rounded-full blur-3xl" />
            <div className="relative">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#ff7e67] mb-6">
                Who Clinchd is for
              </div>
              <ul className="space-y-4">
                {isYou.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-[#ff7e67] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="text-white/90 font-semibold leading-snug">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p className="text-center mt-12 text-stone-600 font-medium max-w-2xl mx-auto reveal-up">
          No application. No sales call to find out the price. You sign up,
          connect your Instagram, and your conversations get answered today.
        </p>
      </div>
    </section>
  );
}
