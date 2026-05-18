import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Clinchd vs Inro: Best Instagram DM Tool for Coaches (2026)",
  description:
    "Inro is built for brands running campaigns. Clinchd is built for coaches booking discovery calls. Compare flat $197 unlimited DMs vs Inro's per-contact pricing, plus coaching-specific objection handling.",
  openGraph: {
    title: "Clinchd vs Inro: Best Instagram DM Tool for Coaches (2026)",
    description:
      "Inro is built for brands running campaigns. Clinchd is built for coaches booking discovery calls.",
    url: "https://www.clinchd.io/compare/vs-inro",
    siteName: "Clinchd",
    type: "article",
  },
};

const comparisonRows = [
  { feature: "Built for", competitor: "Brands running campaigns", clinchd: "Coaches booking discovery calls" },
  { feature: "Pricing model", competitor: "Per activated contact (scales up)", clinchd: "Flat $97 (1,500 qualified conversations) or $197 unlimited" },
  { feature: "Starting price", competitor: "€12.99/mo (low-tier contacts)", clinchd: "$97/mo flat" },
  { feature: "Cost at 2,000 DMs/month", competitor: "Significantly more than €12.99", clinchd: "$197 — same as 200 or 20,000 DMs" },
  { feature: "AI training", competitor: "Generic brand-voice templates", clinchd: "Trained on your exact sales script" },
  { feature: "Objection handling", competitor: "Generic AI responses", clinchd: "Handles \"I can't afford it,\" \"I need to think,\" \"I need to ask my partner\"" },
  { feature: "Primary use case", competitor: "Lead magnets, contests, product launches", clinchd: "High-ticket discovery call booking" },
  { feature: "Industry focus", competitor: "E-commerce + DTC consumer brands", clinchd: "Coaches and course creators" },
  { feature: "Discovery call booking", competitor: "Generic link drop", clinchd: "AI drops link when buyer interest peaks" },
  { feature: "Setup time", competitor: "Hours (campaign configuration)", clinchd: "Under 30 minutes" },
  { feature: "Annual commitment", competitor: "Discount requires annual lock-in", clinchd: "Month-to-month, cancel anytime" },
  { feature: "Human takeover", competitor: "Yes", clinchd: "Yes — with hot lead alerts" },
];

const faqs = [
  {
    q: "Inro is also for Instagram DMs — why isn't it a fit for coaches?",
    a: "Inro is purpose-built for brands running marketing campaigns: contests, lead magnets, product launches, story-reply giveaways. Its AI is tuned for broad audience engagement and contact capture. Coaching is a different motion: every DM is a sales conversation, not a marketing touchpoint. Coaches need an AI that qualifies budget, handles objections like \"I can't afford it,\" and books a discovery call — not one that drops a coupon code.",
  },
  {
    q: "How does Clinchd's objection handling compare to Inro's AI?",
    a: "Inro's AI is trained generically — it can answer common product questions, send pre-set responses, and route conversations through brand-marketing flows. Clinchd is trained on your exact sales script. When a lead says \"I can't afford it,\" Clinchd handles the objection the way you would on a sales call: it explores the cost-of-inaction, reframes the investment, and either qualifies them through or disqualifies them respectfully. That depth comes from being built for one job — not five.",
  },
  {
    q: "At 2,000 DMs/month, which is actually cheaper?",
    a: "Inro's entry tier (€12.99/mo) covers a small number of activated contacts. Once you scale past that — and a coach doing 2,000 DMs/month is well past it — the bill climbs with every additional activated contact, and the meaningful discounts only unlock with an annual commitment. Clinchd's Unlimited plan is $197/mo flat regardless of volume. For a coach doing 2,000+ DMs/month, Clinchd is dramatically more predictable and usually cheaper than Inro at the same volume.",
  },
  {
    q: "Can I use Inro and Clinchd together?",
    a: "You could, but most coaches don't. If you're running brand-style campaigns (giveaways, contests, product launches) and need to capture broad lists, Inro is fine for that. But the moment a lead becomes a sales conversation — qualification, objection handling, booking a call — you want Clinchd doing the talking. In practice, coaches find Clinchd handles the full inbound flow well enough that a second tool just adds cost and complexity.",
  },
  {
    q: "Does Inro support discovery call booking like Clinchd?",
    a: "Inro can drop a generic booking link in a DM, but the AI doesn't know when to drop it — that's a campaign trigger, not a sales judgment. Clinchd's AI watches for buyer-readiness signals (budget confirmed, timeline confirmed, objections handled) and drops the Calendly or Cal.com link at the moment intent peaks. That timing is the difference between a 10% booking rate and a 25% booking rate.",
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

export default function VsInro() {
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
            Clinchd vs Inro: Built for Coaches, Not Brand Campaigns
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Inro is built for brands running campaigns. Clinchd is built for coaches booking
            discovery calls. If you sell high-ticket coaching and your AI needs to handle
            &ldquo;I can&apos;t afford it&rdquo; on the spot, here&apos;s why the difference
            matters — and why $197 flat beats per-contact pricing the moment your DMs scale.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Clinchd vs Inro at a glance
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="Inro" />
          </div>
        </div>
      </section>

      {/* Narrative */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            The core difference: campaigns vs. conversations
          </h2>

          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Inro = brand campaigns
              </h3>
              <p>
                Inro is built for DTC brands running giveaways, product launches, lead-magnet
                funnels, and story-reply contests. The AI is tuned for broad audience engagement:
                capture the contact, deliver the offer, route them into a campaign sequence. That
                works for a skincare brand giving away a sample pack. It doesn&apos;t work for a
                coach trying to qualify a $3,000 program buyer.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Clinchd = coach sales conversations
              </h3>
              <p>
                Every DM in a coaching business is a sales conversation. Clinchd&apos;s AI is
                trained on your exact sales script and handles the conversation the way you
                would on a discovery call: qualifying budget, exploring pain, handling objections
                like &ldquo;I can&apos;t afford it&rdquo; and &ldquo;I need to think about it,&rdquo;
                and dropping the booking link at the moment intent peaks. It treats every lead
                like a buyer, because in coaching, that&apos;s what they are.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Generic AI vs. your sales script
              </h3>
              <p>
                Inro&apos;s AI is trained generically — it knows brand voice, common product
                questions, and campaign mechanics. It does not know the four objections that
                kill 80% of your discovery calls. Clinchd does, because you tell it. You paste
                in your script, your offer, your pricing, and the specific objections you hear
                most. The AI handles them on the spot in DMs the same way you&apos;d handle them
                on a Zoom call. That&apos;s a different product, not a different setting.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The per-contact pricing trap
              </h3>
              <p>
                Inro&apos;s entry tier starts at €12.99/mo for a low number of activated contacts.
                That&apos;s fine for a brand piloting a small campaign. For a coach who does 2,000
                DMs in a month — entirely normal after a Reel goes well — Inro&apos;s bill climbs
                with every additional activated contact, and the real discounts only unlock with
                an annual commitment. Clinchd&apos;s Unlimited plan is $197/mo flat. 1,500 qualified
                conversations or 50,000, the bill is the same. Your viral Reel shouldn&apos;t be a billing event.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            When to use which tool
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="bg-white rounded-2xl border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Choose Inro if&hellip;
              </h3>
              <ul className="space-y-3 text-stone-500 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  You&apos;re a DTC brand running Reel giveaways or contests
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  You need lead-magnet capture at scale, not sales conversations
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  Your offer is a product, not a $1K-$10K coaching program
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  You can predict campaign volume and budget per-contact pricing
                </li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-[#ff7e67]/20 p-8 soft-shadow bg-[#fff5f2]/30">
              <h3 className="text-lg font-extrabold text-[#ff7e67] mb-3">
                Choose Clinchd if&hellip;
              </h3>
              <ul className="space-y-3 text-stone-500 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  You&apos;re a coach or course creator selling high-ticket offers
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  Your AI needs to handle &ldquo;I can&apos;t afford it&rdquo; on the spot
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  Booking a discovery call is the conversion event
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  You want flat $197 unlimited — no surprise bills when a Reel pops
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing wedge — concrete math */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6">
            The 2,000-DMs-a-month math
          </h2>
          <p className="text-stone-500 text-lg font-medium mb-10 leading-relaxed">
            A coach who runs Instagram seriously sends and replies to thousands of DMs a month.
            Here&apos;s what that looks like on each platform.
          </p>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-stone-50 rounded-2xl border border-stone-100 p-8">
              <div className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-3">
                Inro
              </div>
              <div className="text-3xl font-black text-stone-900 mb-2">Scales with contacts</div>
              <p className="text-stone-500 text-sm leading-relaxed">
                €12.99/mo entry tier covers a small number of activated contacts. At 2,000+
                DMs/month you&apos;re well past the entry tier — the bill climbs as your
                activated-contact count grows, and the meaningful discount tiers require an
                annual commitment.
              </p>
            </div>
            <div className="bg-[#ff7e67] text-white rounded-2xl p-8 shadow-xl shadow-[#ff7e67]/20">
              <div className="text-xs font-bold uppercase tracking-widest text-white/70 mb-3">
                Clinchd Unlimited
              </div>
              <div className="text-3xl font-black mb-2">$197/mo. Flat.</div>
              <p className="text-white/90 text-sm leading-relaxed">
                1,500 qualified conversations or 50,000, the bill is $197. No per-contact fees, no annual lock-in,
                no surprise charges when a Reel hits 500K views. Cancel anytime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why we focus on coaching */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-4 text-center">
            Why we built only for coaches
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-6 text-center">
            High-ticket coaching needs more than capture-and-offer
          </h2>
          <p className="text-stone-600 leading-relaxed text-center max-w-2xl mx-auto">
            Inro's strength is general creator and business automation. Coaches selling $1K+ offers need something different: multi-step qualification on revenue and timeline, empathy-first language, and objection handling for {`"I can't afford it"`} before a call gets booked. Clinchd was designed around those patterns specifically, instead of as one feature inside a broader tool.
          </p>
          <p className="text-sm text-stone-400 mt-6 text-center">
            We're in early access. Your results would be among the first we publish.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Inro vs Clinchd FAQ
          </h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="bg-[#fafaf9] rounded-2xl p-8 border border-stone-100">
                <h3 className="text-lg font-extrabold text-stone-900 mb-3">{faq.q}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="The AI setter built for coaches, not campaigns."
            subheadline="Start your 7-day free trial — no credit card required. Flat $97 to start, $197 unlimited when you scale."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>

      {/* Internal links */}
      <section className="py-12 bg-white border-t border-stone-100">
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
            <Link href="/compare/vs-gohighlevel" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs GoHighLevel &rarr;
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
