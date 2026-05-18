import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Best ChatPlace Alternative for Coaches in 2026",
  description:
    "Looking for a ChatPlace alternative? Clinchd is the AI DM setter built only for coaches selling $500-$25K offers, with niche-specific qualification flows and predictable flat pricing.",
  openGraph: {
    title: "Best ChatPlace Alternative for Coaches in 2026",
    description:
      "ChatPlace is built for general business and e-commerce. Clinchd is built only for coaches.",
    url: "https://www.clinchd.io/compare/chatplace-alternative",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best ChatPlace Alternative for Coaches in 2026",
    description: "ChatPlace serves general business. Clinchd is built only for coaches.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/compare/chatplace-alternative",
  },
};

const comparisonRows = [
  { feature: "Built for", competitor: "General business + e-commerce", clinchd: "Coaches selling $500-$25K offers" },
  { feature: "Coaching-specific qualification", competitor: "Generic flow", clinchd: "12 niche-specific playbooks" },
  { feature: "AI conversation depth", competitor: "Trains on PDFs/website", clinchd: "Trained on coach voice + offer + ICP + objections" },
  { feature: "Calendly + Cal.com booking", competitor: "Manual link drop", clinchd: "AI sends link at the right moment" },
  { feature: "Pricing model", competitor: "Tiered, multi-platform", clinchd: "Flat $97 or $197/mo, Instagram-focused" },
  { feature: "Multi-platform support", competitor: "Instagram, TG, TikTok, WA coming", clinchd: "Instagram-only (deeper, not wider)" },
  { feature: "High-ticket objection scripts", competitor: "Not specialized", clinchd: "Tuned for $5K+ coaching sales" },
  { feature: "Crisis-language detection", competitor: "Not built in", clinchd: "Yes, for sensitive coaching niches" },
];

const faqs = [
  {
    q: "How is Clinchd different from ChatPlace?",
    a: "ChatPlace is a multi-platform AI agent for general business: it covers Instagram, Telegram, TikTok, and is adding WhatsApp. It trains on your PDFs and website to answer questions about your business broadly. Clinchd is the opposite: Instagram-only, but built specifically for coaches selling $500-$25K offers, with deep niche-specific qualification flows and objection handling tuned for high-ticket coaching.",
  },
  {
    q: "Is ChatPlace bad for coaches?",
    a: "ChatPlace works for coaches who want a basic AI agent that can answer FAQ-style questions. It's not optimized for the empathy-first, multi-step qualification flow that high-ticket coaching DMs require. If you sell a $97 course or low-ticket digital product, ChatPlace can be enough. If you sell $1K-$25K coaching, the difference shows up in close rate.",
  },
  {
    q: "Does Clinchd offer multi-platform like ChatPlace does?",
    a: "No, and that's intentional. Clinchd focuses only on Instagram because that's where 90%+ of high-ticket coaching DMs happen. Multi-platform breadth dilutes coaching-specific quality. We'd rather be the best AI DM setter for coaches on Instagram than a passable agent across 4 platforms.",
  },
  {
    q: "Is Clinchd more expensive than ChatPlace?",
    a: "Pricing varies. ChatPlace's tiers depend on usage and platform count. Clinchd is flat: $97/mo for 1,500 qualified conversations or $197/mo for unlimited. For Instagram-focused coaches, Clinchd often comes out at similar or lower total cost with deeper coaching specialization.",
  },
  {
    q: "Can I switch from ChatPlace to Clinchd easily?",
    a: "Yes. Both tools sit on top of your Instagram account through the official API. Setup is under 30 minutes for Clinchd: paste your offer details, link Calendly, run a 7-day calibration. You can run both side-by-side during the free trial.",
  },
];

export default function ChatPlaceAlternativePage() {
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
            ChatPlace Alternative
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Best ChatPlace Alternative for Coaches in 2026
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            ChatPlace is a multi-platform AI agent for general business. Clinchd is the opposite: Instagram-only, built only for coaches selling $500 to $25K offers, with deeper qualification, coaching-specific objection handling, and flat pricing.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Side-by-side comparison
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="ChatPlace" />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Breadth vs depth
          </h2>
          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                ChatPlace: wide
              </h3>
              <p>
                ChatPlace plays the breadth game. Multi-platform (Instagram, Telegram, TikTok, WhatsApp coming), serves businesses across e-commerce, services, and creators, and trains on uploaded PDFs and website content. That's a strong fit for someone running a multi-channel business with general FAQ-style customer questions.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Clinchd: deep
              </h3>
              <p>
                Clinchd plays the depth game. Instagram-only, coaches-only, with 12 niche-specific playbooks (fitness, business, life, relationship, health, mindset, dating, nutrition, career, course creators, wellness, financial). The AI is trained on the language coaches actually use, the objections coaches actually face, and the qualification flows that work for $500-$25K offers.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Which to pick
              </h3>
              <p>
                If your business is e-commerce, services, or general creator content across multiple platforms, ChatPlace is a strong match. If you sell coaching offers above $500 on Instagram and your DM conversion depends on empathy, qualification, and high-ticket objection handling, Clinchd is built for that exact job.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            ChatPlace alternative FAQ
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
            <Link href="/compare/tailortalk-alternative" className="text-sm font-bold text-[#ff7e67] hover:underline">TailorTalk alternative &rarr;</Link>
            <Link href="/compare/setsmart-alternative" className="text-sm font-bold text-[#ff7e67] hover:underline">SetSmart alternative &rarr;</Link>
            <Link href="/compare/best-ai-dm-tool-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">Best AI DM tool for coaches 2026 &rarr;</Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">AI DM Setter for Coaches &rarr;</Link>
          </div>
        </div>
      </section>
    </>
  );
}
