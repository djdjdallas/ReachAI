import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "How Much Does a Human DM Setter Cost? (2026 Pricing Breakdown)",
  description:
    "Human DM setters cost $2,000 to $4,000 per month for part-time work and $4,000 to $8,000 for full-time, plus management overhead. Full pricing breakdown and AI alternative.",
  openGraph: {
    title: "How Much Does a Human DM Setter Cost? (2026 Pricing Breakdown)",
    description:
      "$2,000 to $4,000/mo for part-time, $4,000 to $8,000/mo for full-time. Full breakdown.",
    url: "https://www.clinchd.io/faq/how-much-does-a-human-dm-setter-cost",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "How Much Does a Human DM Setter Cost? (2026 Pricing Breakdown)",
    description: "Full breakdown of human DM setter pricing in 2026.",
  },
  alternates: {
    canonical:
      "https://www.clinchd.io/faq/how-much-does-a-human-dm-setter-cost",
  },
};

const question = "How much does a human DM setter cost?";
const directAnswer =
  "A part-time human DM setter typically costs $2,000 to $4,000 per month. A full-time setter runs $4,000 to $8,000 per month. Most setters work hourly at $15 to $40 per hour, or on commission of 5% to 15% of closed deals. Add 20% to 30% on top for management, training, and turnover overhead.";

export default function FaqHowMuchDoesHumanSetterCost() {
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
        url: "https://www.clinchd.io/faq/how-much-does-a-human-dm-setter-cost",
      },
    },
  };

  const tiers = [
    {
      title: "Part-time setter",
      price: "$2,000 – $4,000/mo",
      details: [
        "20-30 hours per week",
        "Hourly rate: $15-$30/hour",
        "Works 9 AM-5 PM EST typically",
        "Best for coaches with 5K-20K followers",
      ],
    },
    {
      title: "Full-time setter",
      price: "$4,000 – $8,000/mo",
      details: [
        "40 hours per week",
        "Hourly rate: $25-$45/hour",
        "Works business hours, sometimes evenings",
        "Best for coaches with 20K+ followers",
      ],
    },
    {
      title: "Commission-based setter",
      price: "5%-15% of revenue",
      details: [
        "No base, paid per closed deal",
        "Aligned with results",
        "Higher quality, harder to find",
        "Best when LTV is $5K+",
      ],
    },
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
            How much does a human DM setter cost?
          </h1>
          <div className="bg-[#fff5f2] rounded-[2rem] border border-[#ff7e67]/20 p-8 md:p-10 mb-10">
            <p className="text-lg md:text-xl text-stone-700 font-medium leading-relaxed">
              {directAnswer}
            </p>
          </div>
        </div>
      </section>

      {/* Tier breakdown */}
      <section className="py-8 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-6">
            Pricing by setup
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tiers.map((t) => (
              <div
                key={t.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">
                  {t.title}
                </p>
                <p className="text-2xl font-black text-stone-900 mb-4">{t.price}</p>
                <ul className="space-y-2 text-sm text-stone-500">
                  {t.details.map((d) => (
                    <li key={d} className="flex items-start gap-2">
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#ff7e67]" />
                      <span className="leading-relaxed">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hidden costs */}
      <section className="py-12 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-4">
            The hidden costs
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Sticker price isn't the full cost. Add 20% to 30% on top for the work that goes into running a setter:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>2-4 weeks of onboarding before they're producing</li>
              <li>Ongoing management and quality review</li>
              <li>Turnover (most setters last 6-12 months)</li>
              <li>Vacation, sick days, off-days that produce zero replies</li>
              <li>Coverage gaps when a Reel goes viral at 11 PM</li>
            </ul>
          </div>
        </div>
      </section>

      {/* AI alternative */}
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-4">
            The AI alternative
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              An AI DM setter like Clinchd costs $97 to $197 per month for unlimited conversations. Same job, 24/7, no management. One month of a human setter pays for nearly two years of AI.
            </p>
            <p>
              <Link href="/ai-dm-setter" className="font-bold text-[#ff7e67] hover:underline">
                Read the full AI DM setter guide &rarr;
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
            <Link href="/faq/can-ai-book-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Can AI book discovery calls from Instagram? &rarr;
            </Link>
            <Link href="/faq/how-fast-should-you-respond-to-instagram-dms" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How fast should you respond to Instagram DMs? &rarr;
            </Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI DM Setter for Coaches &rarr;
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
            headline="Replace your setter for $197/mo"
            subheadline="Start your 7-day free trial. The AI handles everything a human setter does, 24/7."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>
    </>
  );
}
