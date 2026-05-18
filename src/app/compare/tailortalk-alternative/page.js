import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Best TailorTalk Alternative for Coaches in 2026",
  description:
    "Looking for a TailorTalk alternative? Clinchd is the AI DM setter built only for coaches with transparent flat pricing and coaching-specific qualification flows.",
  openGraph: {
    title: "Best TailorTalk Alternative for Coaches in 2026",
    description:
      "TailorTalk requires a sales call to learn pricing. Clinchd is transparent: $97 or $197/mo flat.",
    url: "https://www.clinchd.io/compare/tailortalk-alternative",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Best TailorTalk Alternative for Coaches in 2026",
    description: "Transparent pricing, coaching-specific design, no sales call required.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/compare/tailortalk-alternative",
  },
};

const comparisonRows = [
  { feature: "Pricing transparency", competitor: "Sales call required", clinchd: "$97 or $197/mo on the website" },
  { feature: "Built for", competitor: "Fashion brands, clinics, education", clinchd: "Coaches selling $500-$25K offers" },
  { feature: "Coaching-specific qualification", competitor: "General sales qualification", clinchd: "Coaching-tuned (BTFU framework)" },
  { feature: "Niche playbooks", competitor: "One general flow", clinchd: "12 coaching niches with distinct playbooks" },
  { feature: "Trial without sales call", competitor: "Demo-required", clinchd: "Self-serve 7-day free trial" },
  { feature: "Calendly + Cal.com integration", competitor: "Generic handoff", clinchd: "AI sends link at the right moment" },
  { feature: "Crisis-language detection", competitor: "Not built in", clinchd: "Yes, for sensitive coaching niches" },
  { feature: "Setup time", competitor: "Sales-led implementation", clinchd: "Under 30 minutes self-serve" },
];

const faqs = [
  {
    q: "Why is finding TailorTalk pricing so hard?",
    a: "TailorTalk doesn't publish public pricing. To get a quote, you have to schedule a sales call and go through a discovery process. That makes sense for enterprise customers like clinics and fashion brands, but it's friction for solo coaches who want to evaluate options quickly. Clinchd publishes flat pricing on the website ($97/mo or $197/mo) so you can decide in 30 seconds.",
  },
  {
    q: "Is TailorTalk built for coaches?",
    a: "TailorTalk is built for sales-led businesses generally: fashion brands, clinics, education businesses, and other operators using Instagram conversations to drive bookings or purchases. It does sophisticated conversational AI work. It's not specifically tuned for the way high-ticket coaches sell, where empathy-first language and coaching-specific objections matter more than catalog browsing.",
  },
  {
    q: "How is Clinchd's AI different from TailorTalk's?",
    a: "Both are real AI (not keyword chatbots). The difference is what they're optimized for. TailorTalk excels at product browsing, multimedia handoffs, and broad sales qualification. Clinchd excels at coaching-specific qualification (budget, timeline, fit, urgency for coaching offers), empathy-first language for sensitive niches, and high-ticket objection handling for $500-$25K offers.",
  },
  {
    q: "Is the price gap meaningful?",
    a: "TailorTalk's pricing isn't public, so direct comparison is hard. What we hear from coaches who've gotten quotes: TailorTalk is competitive at higher tiers with team features. Clinchd is straightforward: $97 or $197/mo, no sales call, no commitment beyond the monthly term, no escalation path you have to negotiate.",
  },
  {
    q: "Can I try Clinchd without a sales call?",
    a: "Yes. Self-serve 7-day free trial. No credit card. No demo call. You sign up, connect Instagram, paste your offer details, and the AI is running within 30 minutes.",
  },
];

export default function TailorTalkAlternativePage() {
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
            TailorTalk Alternative
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Best TailorTalk Alternative for Coaches in 2026
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            TailorTalk hides pricing behind a sales call and is built for fashion brands, clinics, and education businesses. Clinchd is built only for coaches, with public pricing, self-serve setup, and coaching-specific qualification flows.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Side-by-side comparison
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="TailorTalk" />
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Why coaches pick Clinchd over TailorTalk
          </h2>
          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Public pricing
              </h3>
              <p>
                Coaching businesses don't have a procurement department. Decisions get made by the coach, often in a single afternoon. A tool that requires a sales call to learn the price doesn't fit that workflow. Clinchd publishes pricing on the homepage, the comparison pages, and every signup flow. $97/mo for 1,500 qualified conversations, $197/mo for unlimited. No call required.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Built for coaching, not retail
              </h3>
              <p>
                TailorTalk is the kind of tool a clinic, fashion brand, or course provider with multimedia catalogs deploys. The features (product browsing, image/PDF handoffs, retail-style qualification) are valuable in those contexts. They don't map cleanly to coaching DMs, where the qualification is empathy-led and the objections are about commitment and investment, not SKUs.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Self-serve, fast
              </h3>
              <p>
                Clinchd is fully self-serve. You sign up, connect Instagram, paste in your offer details, and the AI is running within 30 minutes. No demo call, no implementation team, no minimum commitment beyond the monthly subscription. Coaches who want to evaluate, decide, and act in the same week can do exactly that.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            TailorTalk alternative FAQ
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
            headline="Try Clinchd without a sales call"
            subheadline="Start your 7-day free trial. No credit card. Set up in under 30 minutes."
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
            <Link href="/compare/chatplace-alternative" className="text-sm font-bold text-[#ff7e67] hover:underline">ChatPlace alternative &rarr;</Link>
            <Link href="/compare/setsmart-alternative" className="text-sm font-bold text-[#ff7e67] hover:underline">SetSmart alternative &rarr;</Link>
            <Link href="/compare/best-ai-dm-tool-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">Best AI DM tool for coaches 2026 &rarr;</Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">AI DM Setter for Coaches &rarr;</Link>
          </div>
        </div>
      </section>
    </>
  );
}
