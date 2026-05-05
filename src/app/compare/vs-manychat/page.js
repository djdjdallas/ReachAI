import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Clinchd vs ManyChat: Best Instagram DM Tool for Coaches (2026)",
  description:
    "Comparing Clinchd vs ManyChat for coaches in 2026? See why coaches are switching. Flat $97/month vs unpredictable per-contact pricing. AI conversations vs rigid flows.",
  openGraph: {
    title: "Clinchd vs ManyChat: Best Instagram DM Tool for Coaches (2026)",
    description:
      "Comparing Clinchd vs ManyChat for coaches in 2026? See why coaches are switching.",
    url: "https://www.clinchd.io/compare/vs-manychat",
    siteName: "Clinchd",
    type: "article",
  },
};

const comparisonRows = [
  { feature: "Pricing model", competitor: "Per contact (scales up fast)", clinchd: "Flat $97/month" },
  { feature: "Starting price", competitor: "$15/month (500 contacts)", clinchd: "$97/month" },
  { feature: "Price at 10K contacts", competitor: "$115/month", clinchd: "Still $97/month" },
  { feature: "AI conversation quality", competitor: "Rule-based flows + basic intent", clinchd: "True AI-powered conversations" },
  { feature: "Setup time", competitor: "5+ hours (flow builder)", clinchd: "Under 30 minutes" },
  { feature: "Built for coaches", competitor: "Generic platform", clinchd: "Yes — coach-specific" },
  { feature: "Instagram-native", competitor: "Adapted from Messenger", clinchd: "Built for Instagram" },
  { feature: "Lead qualification", competitor: "Flow-based decision trees", clinchd: "AI that understands context" },
  { feature: "Objection handling", competitor: "Manual flow paths", clinchd: "AI-powered, dynamic" },
  { feature: "Calendar booking", competitor: "Manual link in flow", clinchd: "AI drops link at right moment" },
  { feature: "Human takeover", competitor: "Yes", clinchd: "Yes — with hot lead flagging" },
  { feature: "Free trial", competitor: "Free plan (1K contacts)", clinchd: "7-day free trial" },
];

const faqs = [
  {
    q: "Can I import my ManyChat flows into Clinchd?",
    a: "Clinchd doesn't use flows — it uses AI. Instead of importing rigid decision trees, you describe your offer, ideal client, and objection-handling style. Clinchd's AI generates natural conversations from that. Most coaches find this faster and more effective than rebuilding flows.",
  },
  {
    q: "Is Clinchd harder to set up than ManyChat?",
    a: "It's significantly easier. ManyChat requires hours of flow building, testing branches, and connecting nodes. Clinchd setup takes under 30 minutes: connect your Instagram, describe your coaching offer, review the AI script, and activate. No visual flow builder to wrestle with.",
  },
  {
    q: "What if I'm already paying for ManyChat Pro?",
    a: "You can run both side by side during a trial period. Many coaches test Clinchd for 7 days while keeping ManyChat active, compare the booking rates, and then make the switch. We see most coaches cancel ManyChat within the first week.",
  },
  {
    q: "Does Clinchd support comment-to-DM automation like ManyChat?",
    a: "Yes. When someone comments a trigger word on your post or Reel, Clinchd automatically sends them a DM and starts the qualification conversation. The difference is what happens next — instead of a rigid flow, they get a real AI conversation.",
  },
  {
    q: "Will I save money switching from ManyChat to Clinchd?",
    a: "If you have fewer than about 3,000 contacts in ManyChat, their pricing may be lower. But the moment you grow — especially if a Reel goes viral — ManyChat's per-contact fees spike. Clinchd is $97/month regardless of how many DMs you receive. For growing coaches, the savings are significant.",
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

export default function VsManyChat() {
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
            Clinchd vs ManyChat: Which Is Better for Coaches in 2026?
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            ManyChat has been the default Instagram automation tool for years. But in 2026,
            coaches are switching to AI-native tools that actually have conversations — not
            just run decision trees. Here&apos;s how Clinchd and ManyChat compare, and why
            the switch is happening.
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
            <ComparisonTable rows={comparisonRows} competitorName="ManyChat" />
          </div>
        </div>
      </section>

      {/* Where ManyChat Falls Short */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Where ManyChat falls short for coaches
          </h2>

          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                The per-contact pricing trap
              </h3>
              <p>
                ManyChat&apos;s free plan caps you at 1,000 contacts. After that, you&apos;re
                paying based on how many people DM you. At 5,000 contacts you&apos;re at $65/month.
                At 10,000, it&apos;s $115. And here&apos;s the real problem: when your Reel goes
                viral and 3,000 new people hit your DMs in a weekend, your ManyChat bill spikes
                with no warning. You&apos;re literally penalized for your content performing well.
                Clinchd charges a flat $97/month — whether you get 50 DMs or 5,000.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Flow builders aren&apos;t conversations
              </h3>
              <p>
                ManyChat&apos;s core mechanic is a visual flow builder where you connect nodes,
                buttons, and branches. It works for simple things like &ldquo;comment X to get
                the link.&rdquo; But real lead qualification requires understanding context,
                handling unexpected responses, and knowing when to push and when to pull back.
                ManyChat can&apos;t do that — it follows a script. When a lead says something
                your flow didn&apos;t anticipate, the conversation breaks. With Clinchd, the AI
                understands what the lead is actually saying and responds naturally.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Built for Messenger, adapted for Instagram
              </h3>
              <p>
                ManyChat started as a Facebook Messenger tool and later added Instagram support.
                That DNA shows. The Instagram integration has limitations that Messenger doesn&apos;t —
                and some of ManyChat&apos;s best features don&apos;t work as well on Instagram.
                Clinchd was built from day one specifically for Instagram DMs. Every feature,
                every interaction pattern, and every AI behavior is designed for how coaches
                actually sell on Instagram in 2026.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                No vertical focus
              </h3>
              <p>
                ManyChat serves e-commerce brands, restaurants, agencies, real estate agents, and
                coaches all with the same tool. There&apos;s nothing coach-specific about their
                templates, their AI training, or their qualification logic. Clinchd is built
                exclusively for coaches and course creators selling high-ticket offers. The AI
                knows what a discovery call is, understands common coaching objections, and knows
                the difference between a tire kicker and a $5,000 buyer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Coaches Are Switching */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            Why coaches are switching to Clinchd
          </h2>

          <div className="space-y-12">
            <div className="bg-white rounded-2xl border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-4">
                The weekend launch scenario
              </h3>
              <p className="text-stone-500 mb-4">
                <strong className="text-stone-700">Before (ManyChat):</strong> You post a Reel
                announcing your new program on Friday evening. 200 people comment &ldquo;INFO.&rdquo;
                ManyChat sends them all the same generic flow. Half drop off at the first button.
                The other half get stuck in a branch that doesn&apos;t handle their specific
                question. You spend Sunday manually replying to the ones who fell through the cracks.
              </p>
              <p className="text-stone-500">
                <strong className="text-stone-700">After (Clinchd):</strong> Same Reel, same 200
                comments. Clinchd DMs each person and starts a real conversation — asking about
                their situation, qualifying their budget and timeline, handling objections like
                &ldquo;I need to talk to my partner&rdquo; and &ldquo;what&apos;s included?&rdquo;
                By Monday morning you have 23 discovery calls booked. You didn&apos;t open your DMs once.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-4">
                The viral Reel scenario
              </h3>
              <p className="text-stone-500 mb-4">
                <strong className="text-stone-700">Before (ManyChat):</strong> Your Reel hits
                500K views and your DMs explode. ManyChat adds 4,000 new contacts in a week.
                Your bill jumps from $45 to $145. You&apos;re paying more but the flow is still
                the same robotic experience.
              </p>
              <p className="text-stone-500">
                <strong className="text-stone-700">After (Clinchd):</strong> Same viral Reel.
                Clinchd handles every single DM with the same quality AI conversation. Your bill?
                Still $97. No contact limits, no surprises. And because the AI adapts to each
                person, your booking rate actually stays consistent even at higher volume.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-4">
                The VA replacement scenario
              </h3>
              <p className="text-stone-500 mb-4">
                <strong className="text-stone-700">Before (ManyChat + VA):</strong> You&apos;re
                paying $1,500/month for a VA to handle DMs plus $45/month for ManyChat to send
                the initial trigger message. Your VA is great but she works 9-5 in a different
                timezone. Leads who message at midnight get replies at 10 AM — by which time
                they&apos;ve found another coach.
              </p>
              <p className="text-stone-500">
                <strong className="text-stone-700">After (Clinchd):</strong> Clinchd handles all
                first-touch conversations 24/7. It qualifies leads, handles initial objections,
                and books calls around the clock. Your VA now only handles the warm handoffs that
                need a human touch — and she&apos;s doing it in 2 hours/day instead of 8. Your
                total cost went from $1,545/month to $97/month.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why a language model beats chat flows */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-4 text-center">
            Why we don't use chat flows
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-6 text-center">
            Coaching DMs are too messy for if-this-then-that
          </h2>
          <p className="text-stone-600 leading-relaxed text-center max-w-2xl mx-auto">
            ManyChat's drag-and-drop flow builder is great for e-commerce, where customers ask the same three questions in the same order. Coaching DMs don't behave that way. Leads jump topics, share emotional context, and ask things you never thought to anticipate. That's why Clinchd uses a language model that reads each message in context, instead of routing through pre-built blocks that die at the first off-script reply.
          </p>
          <p className="text-sm text-stone-400 mt-6 text-center">
            We're in early access. Your results would be among the first we publish.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            ManyChat vs Clinchd FAQ
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
            headline="Ready to switch from ManyChat?"
            subheadline="Start your 7-day free trial — no credit card required. Set up in under 30 minutes."
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
            <Link href="/compare/vs-inro" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs Inro &rarr;
            </Link>
            <Link href="/compare/vs-gohighlevel" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs GoHighLevel &rarr;
            </Link>
            <Link href="/compare/vs-setter-ai" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs Setter AI &rarr;
            </Link>
            <Link href="/blog/manychat-alternative-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Best ManyChat Alternatives for Coaches &rarr;
            </Link>
            <Link href="/blog/how-to-automate-instagram-dms-coaching-business" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How to Automate Instagram DMs &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
