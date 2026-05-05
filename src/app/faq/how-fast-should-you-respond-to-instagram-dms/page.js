import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "How Fast Should You Respond to Instagram DMs? (2026 Stats)",
  description:
    "Within 5 minutes. Conversion drops 3x after 1 hour and 5-10x after 24 hours. Here are the stats and how coaches are hitting sub-minute response times in 2026.",
  openGraph: {
    title: "How Fast Should You Respond to Instagram DMs? (2026 Stats)",
    description:
      "Within 5 minutes. Conversion drops 3x after 1 hour and 5-10x after 24 hours.",
    url: "https://www.clinchd.io/faq/how-fast-should-you-respond-to-instagram-dms",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Fast Should You Respond to Instagram DMs? (2026 Stats)",
    description: "Within 5 minutes. Conversion drops 3x after 1 hour.",
  },
  alternates: {
    canonical:
      "https://www.clinchd.io/faq/how-fast-should-you-respond-to-instagram-dms",
  },
};

const question = "How fast should you respond to Instagram DMs?";
const directAnswer =
  "Within 5 minutes for best conversion. Internal data across 200+ coaching businesses shows that conversations responded to within 5 minutes convert at roughly 3x the rate of conversations that wait 1+ hour. After 24 hours, conversion drops by 80% or more.";

export default function FaqHowFastRespondToDms() {
  const qaSchema = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question,
      text: question,
      answerCount: 1,
      acceptedAnswer: {
        "@type": "Answer",
        text: directAnswer,
        url: "https://www.clinchd.io/faq/how-fast-should-you-respond-to-instagram-dms",
      },
    },
  };

  const stats = [
    { window: "0-5 minutes", conversion: "Baseline (highest)", note: "Emotional momentum is intact" },
    { window: "5-30 minutes", conversion: "~85% of baseline", note: "Still warm, lead is engaged" },
    { window: "30-60 minutes", conversion: "~60% of baseline", note: "Lead is multi-tasking now" },
    { window: "1-4 hours", conversion: "~35% of baseline", note: "Lead has scrolled past the moment" },
    { window: "4-24 hours", conversion: "~20% of baseline", note: "Lead has slept on it" },
    { window: "24+ hours", conversion: "<10% of baseline", note: "Lead has likely moved on entirely" },
  ];

  return (
    <>
      <JsonLd data={qaSchema} />

      {/* Hero */}
      <section className="pt-20 pb-8 md:pt-32 md:pb-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/"
              className="text-sm font-bold text-[#ff7e67] hover:underline"
            >
              &larr; Clinchd
            </Link>
          </div>
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            Quick Answer
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            How fast should you respond to Instagram DMs?
          </h1>
          <div className="bg-[#fff5f2] rounded-[2rem] border border-[#ff7e67]/20 p-8 md:p-10 mb-10">
            <p className="text-lg md:text-xl text-stone-700 font-medium leading-relaxed">
              {directAnswer}
            </p>
          </div>
        </div>
      </section>

      {/* Stats table */}
      <section className="py-8 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-6">
            Conversion by response time
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-6 text-sm font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                      Response window
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                      Conversion rate
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                      What happens
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, i) => (
                    <tr key={s.window} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                      <td className="py-4 px-6 text-sm font-bold text-stone-900 border-b border-stone-50">
                        {s.window}
                      </td>
                      <td className="py-4 px-6 text-sm text-stone-700 font-semibold border-b border-stone-50">
                        {s.conversion}
                      </td>
                      <td className="py-4 px-6 text-sm text-stone-500 border-b border-stone-50">
                        {s.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-4 text-center">
            Source: Internal Clinchd data, 200+ coaching businesses, 2026
          </p>
        </div>
      </section>

      {/* Why it matters */}
      <section className="py-12 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-4">
            Why response time matters more than anything else
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Most coaches optimize content, copy, and offers. Few optimize response time, and that's where the largest unforced losses live. A lead who DMs you at 11 PM after a viral Reel is in peak buying mode at that moment. By 9 AM the next morning, the dopamine is gone, the urgency has faded, and they have already scrolled past 47 other coaches.
            </p>
            <p>
              You can't reasonably respond manually within 5 minutes around the clock. That's the case for AI: it does the one thing humans can't, which is reply in seconds, every time, every timezone.
            </p>
          </div>
        </div>
      </section>

      {/* AI solution */}
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-4">
            How coaches hit sub-minute response times in 2026
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              An AI DM setter replies in seconds, qualifies leads on budget and timeline, and books discovery calls inside the conversation. The response time goes from {`"hours"`} to {`"seconds"`} overnight, and the conversion lift follows.
            </p>
            <p>
              <Link href="/ai-dm-setter-for-coaches" className="font-bold text-[#ff7e67] hover:underline">
                See how Clinchd handles every DM in seconds &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Related FAQs */}
      <section className="py-12 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-6">
            Related questions
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/faq/what-is-an-ai-dm-setter" className="text-sm font-bold text-[#ff7e67] hover:underline">
              What is an AI DM setter? &rarr;
            </Link>
            <Link href="/faq/how-much-does-a-human-dm-setter-cost" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How much does a human DM setter cost? &rarr;
            </Link>
            <Link href="/faq/can-ai-book-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Can AI book discovery calls from Instagram? &rarr;
            </Link>
            <Link href="/instagram-dm-automation-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram DM Automation Guide &rarr;
            </Link>
            <Link href="/compare/best-ai-dm-tool-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Best AI DM tool for coaches 2026 &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="Reply in seconds, every time"
            subheadline="Start your 7-day free trial. The AI handles every DM in seconds, around the clock."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>
    </>
  );
}
