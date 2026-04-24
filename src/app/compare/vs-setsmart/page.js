import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Clinchd vs SetSmart: Best AI DM Setter for Coaches (2026)",
  description:
    "Clinchd vs SetSmart for coaches in 2026. Same price, different depth. See why coaching-specific AI, flat pricing, and real social proof make Clinchd the better AI DM setter.",
  openGraph: {
    title: "Clinchd vs SetSmart: Best AI DM Setter for Coaches (2026)",
    description:
      "Clinchd vs SetSmart for coaches in 2026. Same price, different depth.",
    url: "https://www.clinchd.io/compare/vs-setsmart",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinchd vs SetSmart: Best AI DM Setter for Coaches (2026)",
    description:
      "Clinchd vs SetSmart for coaches in 2026. Same price, different depth.",
  },
};

const comparisonRows = [
  { feature: "Monthly price", competitor: "$99/month", clinchd: "$97/month" },
  { feature: "Pricing model", competitor: "Message-based (scales up)", clinchd: "Flat rate — unlimited DMs" },
  { feature: "Coaching-specific AI training", competitor: "Coaches + consultants + agencies", clinchd: "Built exclusively for coaches" },
  { feature: "Conversation quality", competitor: "Template-driven replies", clinchd: "True AI-powered natural conversations" },
  { feature: "Setup time", competitor: "1-2 hours", clinchd: "Under 30 minutes" },
  { feature: "Comment-to-DM automation", competitor: "Yes", clinchd: "Yes — with AI qualification built in" },
  { feature: "Lead qualification depth", competitor: "Basic filtering", clinchd: "Multi-step AI qualification (budget, timeline, fit)" },
  { feature: "Objection handling", competitor: "Scripted responses", clinchd: "AI-powered, adapts to context" },
  { feature: "Calendar booking (Calendly/Cal.com)", competitor: "Manual link drop", clinchd: "AI sends link at the right moment" },
  { feature: "Human takeover + hot lead alerts", competitor: "Basic handoff", clinchd: "Instant alerts with lead context summary" },
  { feature: "Independent reviews (G2/Capterra)", competitor: "None", clinchd: "Verified coach testimonials" },
  { feature: "Meta Business Partner status", competitor: "No", clinchd: "Yes — API-compliant" },
];

const faqs = [
  {
    q: "Is SetSmart worth $99/month?",
    a: "SetSmart offers DM automation at $99/month, but its message-based pricing means your actual cost can climb as your volume grows. If you are a coach sending hundreds of DMs per month, the bill can become unpredictable. At $97/month flat, Clinchd gives you unlimited conversations with no surprise charges.",
  },
  {
    q: "How is Clinchd different from SetSmart?",
    a: "The biggest difference is focus. SetSmart serves coaches, consultants, and agencies with a broad feature set. Clinchd is built exclusively for coaches selling high-ticket offers on Instagram. That means every AI behavior, objection-handling script, and qualification flow is designed around how coaches actually sell. The result is higher-quality conversations and more booked calls.",
  },
  {
    q: "Does SetSmart have independent reviews?",
    a: "As of 2026, SetSmart has no listings on G2, Capterra, or Trustpilot. There are no independent, verified reviews from real users. Clinchd has published case studies and testimonials from coaches across fitness, business, and life coaching niches, with specific metrics like calls booked and revenue generated.",
  },
  {
    q: "Can I switch from SetSmart to Clinchd?",
    a: "Yes. Clinchd does not require you to import anything from SetSmart. You connect your Instagram account, describe your coaching offer, and the AI is ready to go in under 30 minutes. Most coaches run both side by side during the 7-day free trial and compare booking rates before making the full switch.",
  },
  {
    q: "Which AI is better for high-ticket coaches?",
    a: "For coaches selling $1K+ offers, the AI needs to do more than send quick replies. It needs to qualify leads on budget and timeline, handle objections like pricing hesitation and partner approval, and know when to book a call versus when to nurture. Clinchd was trained specifically for these high-ticket coaching conversations. SetSmart uses a more general approach that works across industries but lacks that depth.",
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

export default function VsSetSmart() {
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
            Clinchd vs SetSmart: Which AI DM Setter Is Better for Coaches?
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Nearly identical price. Completely different depth. SetSmart serves coaches,
            consultants, and agencies. Clinchd was built for exactly one use case — high-ticket
            coaching on Instagram. Here&apos;s how they compare in 2026.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
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

      {/* Narrative sections */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Where SetSmart falls short for coaches
          </h2>

          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The pricing story
              </h3>
              <p>
                SetSmart starts at $99/month, which looks comparable to Clinchd&apos;s $97.
                But the similarity ends at the sticker price. SetSmart uses message-based
                pricing, which means your actual cost scales with how many DM conversations
                the AI handles. When your Reel goes viral and 2,000 new leads flood your
                inbox in a weekend, your SetSmart bill climbs with them. You are paying more
                precisely when your content performs best.
              </p>
              <p className="mt-4">
                Clinchd is flat-rate. $97/month for the Base plan, $197/month for Unlimited.
                Whether you get 50 DMs or 5,000, the price does not change. For coaches who
                post content consistently and experience unpredictable spikes in engagement,
                flat pricing is the only model that makes sense.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The coaching-specificity gap
              </h3>
              <p>
                SetSmart markets itself to coaches, consultants, and agencies. That breadth
                means their AI is trained to handle conversations across multiple industries.
                It works, but it is not optimized for the specific way coaches sell high-ticket
                offers on Instagram.
              </p>
              <p className="mt-4">
                Clinchd does one thing: it helps coaches qualify leads, handle coaching-specific
                objections, and book discovery calls. The AI understands what a $5K mastermind
                is. It knows how to respond when a lead says &ldquo;I need to talk to my
                partner&rdquo; or &ldquo;I&apos;ve been burned by coaches before.&rdquo; It
                knows the difference between a tire-kicker asking &ldquo;how much?&rdquo; in
                the first message and a serious buyer asking for program details. That depth
                comes from building exclusively for one vertical, not spreading across three.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The social proof problem
              </h3>
              <p>
                As of 2026, SetSmart has zero listings on G2, Capterra, or Trustpilot. There
                are no independent, verified reviews from real users. That does not mean the
                product is bad, but it does mean you are making a purchasing decision based
                entirely on their own marketing. There is no third-party validation to confirm
                what they claim.
              </p>
              <p className="mt-4">
                Clinchd publishes case studies from real coaches with specific numbers:
                discovery calls booked, response times, setter costs replaced. When you are
                investing $97/month into a tool that handles your sales conversations, you
                deserve to see proof from people who look like you, sell like you, and coach
                like you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <blockquote className="text-xl md:text-2xl font-medium text-stone-700 italic leading-relaxed mb-8">
            &ldquo;I tested both SetSmart and Clinchd during the same month. SetSmart felt
            like a general automation tool that happened to work in DMs. Clinchd felt like
            it actually understood my coaching business. The AI asked qualification questions
            I would ask myself. Within three weeks I had 19 discovery calls booked, and my
            SetSmart account had generated 6 in the same window. The difference was obvious.&rdquo;
          </blockquote>
          <p className="font-extrabold text-stone-900">Marcus Rivera</p>
          <p className="text-sm text-stone-400 font-bold">Business Coach, 21K followers &middot; $8K group program</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            SetSmart vs Clinchd FAQ
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
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="Ready to try the AI setter built for coaches?"
            subheadline="Start your 7-day free trial — no credit card required. Set up in under 30 minutes."
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
            <Link href="/compare/vs-inro" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs Inro &rarr;
            </Link>
            <Link href="/compare/vs-gohighlevel" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs GoHighLevel &rarr;
            </Link>
            <Link href="/compare/vs-setter-ai" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs Setter AI &rarr;
            </Link>
            <Link href="/blog/best-manychat-alternative-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">
              7 Best ManyChat Alternatives for Coaches &rarr;
            </Link>
            <Link href="/blog/what-is-an-ai-dm-setter" className="text-sm font-bold text-[#ff7e67] hover:underline">
              What Is an AI DM Setter? &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
