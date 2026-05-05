import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Best Inro Alternative for Coaches in 2026",
  description:
    "Looking for an Inro alternative? Clinchd is the AI DM setter built exclusively for coaches with $500-$25K offers, with niche-specific qualification flows and flat pricing.",
  openGraph: {
    title: "Best Inro Alternative for Coaches in 2026",
    description:
      "Inro is built for general creators. Clinchd is built only for coaches. Here is when to switch.",
    url: "https://www.clinchd.io/compare/inro-alternative",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Inro Alternative for Coaches in 2026",
    description: "Inro is built for general creators. Clinchd is built only for coaches.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/compare/inro-alternative",
  },
};

const comparisonRows = [
  { feature: "Target audience", competitor: "All creators and businesses", clinchd: "Coaches selling $500-$25K offers" },
  { feature: "Niche-specific playbooks", competitor: "One generic flow", clinchd: "12 coaching niches with distinct flows" },
  { feature: "High-ticket objection handling", competitor: "General library", clinchd: "Tuned for $5K+ coaching sales" },
  { feature: "Pricing", competitor: "Tiered, scales with usage", clinchd: "Flat $97 or $197/mo" },
  { feature: "Customer focus", competitor: "All creators and businesses", clinchd: "Coaches selling $500-$25K offers, exclusively" },
  { feature: "Calendly + Cal.com integration", competitor: "Generic link drop", clinchd: "AI sends link at the right moment" },
  { feature: "Crisis-language detection", competitor: "Not built in", clinchd: "Yes, for sensitive coaching niches" },
  { feature: "Setup time", competitor: "1-2 hours", clinchd: "Under 30 minutes" },
];

const faqs = [
  {
    q: "Why look for an Inro alternative?",
    a: "Inro is a strong product for general creators and businesses. The reason coaches look for an alternative is fit: Inro's qualification flows, objection scripts, and tone presets are built for a wide creator audience, not for the specific way high-ticket coaches sell. If you sell $5K+ programs and your DMs require empathy-first language and nuanced qualification, a coach-specific tool tends to outperform.",
  },
  {
    q: "Is Inro bad for coaches?",
    a: "Not at all. Coaches use Inro and get results. The question is whether {`'good enough'`} is enough when a coach-specific tool exists at the same price point. For coaches with high-ticket offers and engaged audiences, the lift from coaching-specific qualification often pays for the switch in the first month.",
  },
  {
    q: "How is Clinchd different from Inro?",
    a: "Three differences. First, Clinchd is built only for coaches, so every script and flow is tuned for coaching DMs. Second, Clinchd has 12 niche-specific playbooks (fitness, business, life, relationship, health, mindset, dating, nutrition, career, course creators, wellness, financial) with distinct objection handling. Third, Clinchd uses flat-rate pricing instead of tiered usage-based pricing.",
  },
  {
    q: "Will my data transfer if I switch from Inro?",
    a: "There's nothing to transfer. Both tools sit on top of your Instagram account through the official API. You set up Clinchd from scratch in under 30 minutes (paste your offer details, link Calendly, run a 7-day calibration), and you can run both side-by-side during the free trial to compare results.",
  },
  {
    q: "Can I see a head-to-head Clinchd vs Inro comparison?",
    a: "Yes. We have a full comparison page that walks through pricing, features, and use case fit.",
  },
];

export default function InroAlternativePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <>
      <JsonLd data={faqSchema} />

      <section className="pt-20 pb-16 md:pt-32 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            Inro Alternative
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Best Inro Alternative for Coaches in 2026
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Inro is built for general creators. Clinchd is built only for coaches with $500 to $25K offers, with 12 niche-specific playbooks, coaching-tuned objection handling, and flat-rate pricing that doesn't scale with your viral moments.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Side-by-side comparison
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="Inro" />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            When Clinchd is the right switch
          </h2>
          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                You sell high-ticket coaching ($1K+)
              </h3>
              <p>
                For coaches selling $1K+ offers, the AI needs more than fast replies. It needs nuance: empathy-first language, multi-step qualification on revenue and timeline, objection handling that sounds like a coach instead of a sales rep. Clinchd's coaching-specific training shows up most clearly here.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Your niche has specific compliance or sensitivity needs
              </h3>
              <p>
                Health coaches, financial coaches, and relationship coaches all operate inside scope-of-practice rules or sensitivity requirements that a general tool isn't tuned for. Clinchd has niche-specific configurations: scope-aware responses for health and financial coaches, crisis-language detection for relationship and mindset coaches, and warmth-first language for life and dating coaches.
            </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                You want predictable monthly cost
              </h3>
              <p>
                Inro's pricing scales with usage. Clinchd is flat-rate at $97/mo for 500 conversations or $197/mo for unlimited. When your Reel goes viral and 2,000 DMs hit in a weekend, your Clinchd bill stays the same. Predictable pricing matters when planning ad spend, content cadence, and growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Inro alternative FAQ
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-white rounded-2xl p-8 border border-stone-100 soft-shadow">
                <h3 className="text-lg font-extrabold text-stone-900 mb-3">{faq.q}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="Try the AI setter built for coaching"
            subheadline="Start your 7-day free trial. No credit card required. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>

      <section className="py-12 bg-[#fafaf9] border-t border-stone-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-6">
            Other comparisons
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/compare/vs-inro" className="text-sm font-bold text-[#ff7e67] hover:underline">Clinchd vs Inro (full comparison) &rarr;</Link>
            <Link href="/compare/setsmart-alternative" className="text-sm font-bold text-[#ff7e67] hover:underline">SetSmart alternative &rarr;</Link>
            <Link href="/compare/best-ai-dm-tool-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">Best AI DM tool for coaches 2026 &rarr;</Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">AI DM Setter for Coaches &rarr;</Link>
          </div>
        </div>
      </section>
    </>
  );
}
