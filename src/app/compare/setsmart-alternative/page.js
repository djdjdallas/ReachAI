import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Best SetSmart Alternative for Coaches in 2026",
  description:
    "Looking for a SetSmart alternative? Clinchd is the AI DM setter built exclusively for coaches, with flat pricing, real reviews, and coaching-specific qualification flows.",
  openGraph: {
    title: "Best SetSmart Alternative for Coaches in 2026",
    description:
      "Looking for a SetSmart alternative? Clinchd is built exclusively for coaches with flat pricing and real reviews.",
    url: "https://www.clinchd.io/compare/setsmart-alternative",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best SetSmart Alternative for Coaches in 2026",
    description: "Coaching-specific AI DM setter, flat pricing, verified reviews.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/compare/setsmart-alternative",
  },
};

const comparisonRows = [
  { feature: "Built for coaches specifically", competitor: "Coaches + consultants + agencies", clinchd: "Yes, exclusively" },
  { feature: "Pricing model", competitor: "Message-based (scales up)", clinchd: "Flat $97 or $197/mo" },
  { feature: "Built specifically for coaches", competitor: "Coaches + consultants + agencies", clinchd: "Yes, only coaches" },
  { feature: "Coaching-specific objection scripts", competitor: "Generic library", clinchd: "Tuned for $500-$25K offers" },
  { feature: "Niche-specific qualification flows", competitor: "One generic flow", clinchd: "12 niches with distinct playbooks" },
  { feature: "Setup time", competitor: "1-2 hours", clinchd: "Under 30 minutes" },
  { feature: "Calendly + Cal.com integration", competitor: "Manual link drop", clinchd: "AI sends link at the right moment" },
  { feature: "Human takeover with context bundle", competitor: "Basic handoff", clinchd: "One click + full conversation summary" },
  { feature: "Meta Business Partner status", competitor: "No", clinchd: "Yes, official API compliant" },
];

const faqs = [
  {
    q: "Why are coaches looking for a SetSmart alternative?",
    a: "The most common reasons: SetSmart's message-based pricing makes the actual cost unpredictable when content goes viral, the AI is built for coaches, consultants, and agencies (so coaching-specific objection handling is shallow), and the product has limited prominent third-party reviews (G2, Capterra, Trustpilot) to validate marketing claims.",
  },
  {
    q: "Is Clinchd cheaper than SetSmart?",
    a: "Sticker prices are similar ($97/mo Clinchd Base vs $99/mo SetSmart). The difference is the pricing model. SetSmart charges per message, so a viral Reel that triggers 2,000 DMs in a weekend can spike your bill. Clinchd is flat-rate. $97 or $197 every month, no matter how many DMs you handle.",
  },
  {
    q: "What about Inro or ManyChat as SetSmart alternatives?",
    a: "Both are credible options for general DM automation. Inro is built for creators and businesses broadly, not coaches specifically. ManyChat is a chat-flow builder, not an AI setter (great for e-commerce, not for high-ticket coaching). Clinchd is the only one in this set built exclusively for coaches selling $500 to $25K offers.",
  },
  {
    q: "How fast can I switch from SetSmart to Clinchd?",
    a: "Under 30 minutes. You connect Instagram, paste your offer details, link Calendly or Cal.com, and run a 7-day calibration window. Most coaches run both side-by-side during the 7-day Clinchd free trial and compare booked-call numbers before fully switching.",
  },
  {
    q: "Does Clinchd offer the same comment-to-DM features as SetSmart?",
    a: "Yes, plus AI qualification built into the comment-to-DM trigger. When a comment triggers a DM, Clinchd's AI takes over the resulting conversation, qualifies the lead, and either books a discovery call or routes to your funnel. SetSmart sends a message and stops there.",
  },
];

export default function SetSmartAlternativePage() {
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
            SetSmart Alternative
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Best SetSmart Alternative for Coaches in 2026
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            SetSmart works for coaches, consultants, and agencies. Clinchd works for one thing: coaches selling $500 to $25K offers. Flat pricing, verified reviews, and AI built specifically for high-ticket coaching DMs.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Side-by-side comparison
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="SetSmart" />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Why coaches switch from SetSmart
          </h2>
          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The pricing trap
              </h3>
              <p>
                SetSmart starts at $99/month, which looks comparable to Clinchd's $97. The difference is what happens when your content performs well. SetSmart bills based on messages handled, so a viral Reel that triggers 2,000 DMs in 48 hours pushes your bill up exactly when you want predictability. Clinchd is flat-rate, every month, regardless of volume.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Generic vs coaching-specific
              </h3>
              <p>
                SetSmart serves coaches, consultants, and agencies with one shared product. The AI knows enough about each market to be passable everywhere and exceptional nowhere. Clinchd is built only for coaches. Every objection script, qualification flow, and tone preset is tuned for high-ticket coaching, with niche-specific playbooks for fitness, business, life, relationship, health, mindset, dating, nutrition, career, course creators, wellness, and financial coaches.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The social proof gap
              </h3>
              <p>
                SetSmart has no prominent presence on G2, Capterra, or Trustpilot as of May 2026. Clinchd is in early access and equally short on independent third-party reviews — we'd rather be transparent about that than overclaim. What we offer instead is methodology: Clinchd was designed around the qualification patterns and objection scripts we saw across hundreds of real coach DM conversations.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            SetSmart alternative FAQ
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
            headline="Try the AI setter built only for coaches"
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
            <Link href="/compare/vs-setsmart" className="text-sm font-bold text-[#ff7e67] hover:underline">Clinchd vs SetSmart (full comparison) &rarr;</Link>
            <Link href="/compare/inro-alternative" className="text-sm font-bold text-[#ff7e67] hover:underline">Inro alternative &rarr;</Link>
            <Link href="/compare/best-ai-dm-tool-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">Best AI DM tool for coaches 2026 &rarr;</Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">AI DM Setter for Coaches &rarr;</Link>
          </div>
        </div>
      </section>
    </>
  );
}
