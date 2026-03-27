import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Clinchd vs GoHighLevel: Instagram DM Automation for Coaches (2026)",
  description:
    "GoHighLevel has shallow Instagram DM features. Clinchd is built specifically for coach DM automation. Compare features, pricing, and setup time.",
  openGraph: {
    title: "Clinchd vs GoHighLevel: Instagram DM Automation for Coaches (2026)",
    description:
      "GoHighLevel has shallow Instagram DM features. Clinchd is built specifically for coach DM automation.",
    url: "https://www.clinchd.io/compare/vs-gohighlevel",
    siteName: "Clinchd",
    type: "article",
  },
};

const comparisonRows = [
  { feature: "Monthly price", competitor: "$97–$297/month", clinchd: "$97/month" },
  { feature: "Instagram DM automation", competitor: "Basic — limited features", clinchd: "Advanced AI conversations" },
  { feature: "AI conversation quality", competitor: "Conversation AI add-on ($49+/mo extra)", clinchd: "Built-in AI — no add-ons" },
  { feature: "Setup complexity", competitor: "2–4 week learning curve", clinchd: "30 minutes" },
  { feature: "Purpose-built for coaches", competitor: "No — agency platform", clinchd: "Yes — coach-specific" },
  { feature: "Comment-to-DM automation", competitor: "Not native", clinchd: "Yes — built in" },
  { feature: "Lead qualification in DMs", competitor: "Limited — basic workflows", clinchd: "AI-powered, context-aware" },
  { feature: "Objection handling", competitor: "Manual workflow branches", clinchd: "AI handles dynamically" },
  { feature: "Calendar booking from DMs", competitor: "Requires workflow setup", clinchd: "AI drops link automatically" },
  { feature: "Human takeover", competitor: "Yes — via Conversations tab", clinchd: "Yes — with hot lead alerts" },
];

const faqs = [
  {
    q: "Should I cancel GoHighLevel if I switch to Clinchd?",
    a: "Not necessarily. Many coaches keep GoHighLevel for their CRM, funnels, and email marketing while using Clinchd specifically for Instagram DM automation. Clinchd does one thing — Instagram DMs — and does it better than GHL. If you're only using GHL for DMs though, Clinchd is a much more cost-effective choice.",
  },
  {
    q: "Does Clinchd integrate with GoHighLevel?",
    a: "Clinchd books calls directly into your calendar (Calendly, Cal.com, or Google Calendar). If you use GHL's built-in calendar, you can connect it via the calendar link. For CRM syncing, you can use webhook integrations to push qualified leads from Clinchd into your GHL pipeline.",
  },
  {
    q: "Is GoHighLevel's Conversation AI as good as Clinchd?",
    a: "GoHighLevel's Conversation AI is a general-purpose add-on that costs $49+/month extra. It works across channels but isn't optimized for Instagram DMs or coach-specific conversations. Clinchd's AI is purpose-built for qualifying coaching leads, handling coaching-specific objections, and booking discovery calls — all within Instagram.",
  },
  {
    q: "I'm paying for GHL + ManyChat already. Is Clinchd cheaper?",
    a: "Most coaches using GHL ($97–$297/mo) + ManyChat ($45–$115/mo) are spending $142–$412/month. If your primary need is Instagram DM automation, Clinchd at $97/month replaces ManyChat entirely and handles the DM use case better than GHL can. That's a potential savings of $45–$315/month.",
  },
  {
    q: "Can Clinchd replace GoHighLevel completely?",
    a: "If you use GHL primarily for Instagram DMs and don't rely heavily on its CRM, funnels, or email features, then yes — Clinchd can replace it for less money. But if you use GHL's full suite (landing pages, email, SMS, pipelines), Clinchd is better positioned as a complement that handles the Instagram DM channel better.",
  },
];

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

export default function VsGoHighLevel() {
  return (
    <>
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            Comparison
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Clinchd vs GoHighLevel: Instagram DM Automation for Coaches (2026)
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            GoHighLevel is a powerful all-in-one marketing platform — but it was built for agencies,
            not coaches. Its Instagram DM automation is shallow, and most coaches end up needing a
            separate tool anyway. Here&apos;s how Clinchd compares and where each tool makes sense.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Feature-by-feature comparison
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="GoHighLevel" />
          </div>
        </div>
      </section>

      {/* Narrative Section */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Why GoHighLevel isn&apos;t enough for Instagram DMs
          </h2>

          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Built for agencies, not coaches
              </h3>
              <p>
                GoHighLevel was designed as a white-label platform for marketing agencies to
                resell to their clients. It&apos;s packed with features — CRM, funnels, email,
                SMS, reputation management, website builder — but none of them are purpose-built
                for coaches selling high-ticket offers on Instagram. The Instagram DM features
                feel like an afterthought compared to the platform&apos;s core strengths in
                SMS and email automation.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The &ldquo;Conversation AI&rdquo; add-on isn&apos;t what you think
              </h3>
              <p>
                GHL offers a &ldquo;Conversation AI&rdquo; feature, but it&apos;s an add-on that
                starts at $49/month on top of your base plan. It&apos;s a general-purpose chatbot
                that works across SMS, email, and messaging — it&apos;s not specifically trained
                for coaching conversations. It doesn&apos;t know what a discovery call is, can&apos;t
                handle coaching-specific objections like &ldquo;I&apos;ve been burned by coaches
                before,&rdquo; and doesn&apos;t understand the nuance of qualifying a $3,000 buyer
                versus someone who just wants free advice.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                No comment-to-DM, no smart triggers
              </h3>
              <p>
                One of the most powerful Instagram growth tactics for coaches in 2026 is
                comment-to-DM automation — someone comments a keyword on your Reel and
                automatically receives a DM. GoHighLevel doesn&apos;t offer this natively.
                You&apos;d need ManyChat alongside GHL to make it work, which means paying for
                two tools. Clinchd handles the comment trigger AND the full AI qualification
                conversation in one platform.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The GHL + ManyChat trap
              </h3>
              <p>
                Here&apos;s what we see constantly: coaches sign up for GoHighLevel ($97/month)
                for their CRM and funnels, then add ManyChat ($45+/month) for Instagram DMs
                because GHL&apos;s DM features aren&apos;t good enough. That&apos;s $142+/month
                for a clunky two-tool setup. Clinchd replaces the ManyChat piece entirely — with
                better AI, better conversations, and better results — for $97/month flat.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Positioning */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            Two ways to think about it
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="bg-white rounded-2xl border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Keep GHL, add Clinchd
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                If you love GoHighLevel for your CRM, funnels, and email marketing — keep it.
                Use Clinchd specifically for Instagram DM automation. They complement each other
                well: GHL handles your backend operations, Clinchd handles the front-of-funnel
                Instagram conversations that feed your pipeline.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-[#ff7e67]/20 p-8 soft-shadow bg-[#fff5f2]/30">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Replace GHL with Clinchd
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                If you&apos;re paying $97–$297/month for GoHighLevel but really only use it for
                Instagram DMs and basic CRM, Clinchd does the DM job better for $97/month. Pair
                it with a free CRM like HubSpot or Notion and you&apos;ve replaced GHL entirely
                while saving money.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <blockquote className="text-xl md:text-2xl font-medium text-stone-700 italic leading-relaxed mb-8">
            &ldquo;I was paying $197/month for GoHighLevel and barely using half the features.
            My Instagram DM automation was basically nonexistent — I still had to manually
            respond to every lead. Switched to Clinchd and in the first week it booked 11
            discovery calls while I was at a conference. I cancelled GHL and haven&apos;t
            looked back.&rdquo;
          </blockquote>
          <p className="font-extrabold text-stone-900">David Chen</p>
          <p className="text-sm text-stone-400 font-bold">Mindset Coach, 22K followers</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            GoHighLevel vs Clinchd FAQ
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

      {/* CTA */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="Better Instagram DMs. Less complexity."
            subheadline="Start your 7-day free trial — no credit card required. Replace your GHL DM setup in 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>

      {/* Internal links */}
      <section className="py-12 bg-[#fafaf9] border-t border-stone-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-6">
            Related comparisons &amp; guides
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/compare/vs-manychat" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs ManyChat &rarr;
            </Link>
            <Link href="/compare/vs-setter-ai" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs Setter AI &rarr;
            </Link>
            <Link href="/blog/manychat-alternative-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Best ManyChat Alternatives for Coaches &rarr;
            </Link>
            <Link href="/blog/ai-instagram-dm-bot-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI Instagram DM Bots for Coaches &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
