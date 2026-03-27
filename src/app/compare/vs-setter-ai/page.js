import Link from "next/link";
import ComparisonTable from "@/components/ComparisonTable";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Clinchd vs Setter AI: Best AI Appointment Setter for Instagram (2026)",
  description:
    "Setter AI automates phone and email outreach but doesn't support Instagram DMs. Clinchd is built for Instagram-first coaches. Compare features, channels, and pricing.",
  openGraph: {
    title: "Clinchd vs Setter AI: Best AI Appointment Setter for Instagram (2026)",
    description:
      "Setter AI automates phone and email outreach but doesn't support Instagram DMs. Clinchd is built for Instagram-first coaches.",
    url: "https://www.clinchd.io/compare/vs-setter-ai",
    siteName: "Clinchd",
    type: "article",
  },
};

const comparisonRows = [
  { feature: "Instagram DM support", competitor: "No — not supported", clinchd: "Yes — purpose-built" },
  { feature: "Primary channels", competitor: "Phone, email, SMS", clinchd: "Instagram DMs" },
  { feature: "AI conversation quality", competitor: "Strong for phone/email", clinchd: "Optimized for Instagram DMs" },
  { feature: "Comment-to-DM triggers", competitor: "Not available", clinchd: "Yes — built in" },
  { feature: "Built for coaches", competitor: "General B2B sales", clinchd: "Yes — coach-specific" },
  { feature: "Lead qualification", competitor: "AI-powered (phone/email)", clinchd: "AI-powered (Instagram)" },
  { feature: "Calendar booking", competitor: "Yes — via phone/email flow", clinchd: "Yes — drops link in DMs" },
  { feature: "Setup time", competitor: "1–2 hours", clinchd: "Under 30 minutes" },
  { feature: "Pricing", competitor: "Custom pricing (starts ~$200+/mo)", clinchd: "Flat $97/month" },
  { feature: "Human takeover", competitor: "Yes", clinchd: "Yes — with hot lead alerts" },
];

const faqs = [
  {
    q: "Can I use Setter AI for Instagram DMs?",
    a: "No. As of 2026, Setter AI does not support Instagram DMs. It focuses on phone calls, email, and SMS outreach. If your primary lead generation channel is Instagram, you need a tool built specifically for that platform — which is exactly what Clinchd does.",
  },
  {
    q: "Is Setter AI better for coaches who use phone and email?",
    a: "If your sales process is primarily phone and email-based, Setter AI is a solid choice for automating outbound. But most coaches in 2026 are generating leads through Instagram content — Reels, Stories, and DMs. For that channel, Clinchd is the better fit.",
  },
  {
    q: "Can I use Clinchd and Setter AI together?",
    a: "Yes, they address different channels. You could use Clinchd for Instagram DM automation and Setter AI for phone/email follow-up. However, most coaches find that Clinchd handles the full qualification-to-booking flow within Instagram, making a second tool unnecessary.",
  },
  {
    q: "Why doesn't Setter AI support Instagram?",
    a: "Instagram's Messaging API has specific requirements and limitations that require purpose-built integrations. Setter AI has focused on phone and email channels where their technology is strongest. Clinchd was built from the ground up specifically for Instagram's API and conversation patterns.",
  },
  {
    q: "Which tool books more discovery calls for coaches?",
    a: "It depends on where your leads come from. If most of your warm leads find you on Instagram (the case for most coaches in 2026), Clinchd will book more calls because it meets leads where they already are — in your DMs. Setter AI can't touch that channel.",
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

export default function VsSetterAI() {
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
            Clinchd vs Setter AI: Best AI Appointment Setter for Instagram (2026)
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Setter AI is a solid AI appointment setter — for phone and email. But it doesn&apos;t
            support Instagram DMs. If you&apos;re a coach generating leads through Instagram
            content, here&apos;s why Clinchd is built for your workflow and Setter AI isn&apos;t.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Clinchd vs Setter AI at a glance
          </h2>
          <div className="bg-white rounded-[2rem] border border-stone-100 overflow-hidden soft-shadow">
            <ComparisonTable rows={comparisonRows} competitorName="Setter AI" />
          </div>
        </div>
      </section>

      {/* Narrative */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12">
            The core difference: channels
          </h2>

          <div className="space-y-10 text-stone-600 leading-relaxed">
            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Setter AI = phone and email
              </h3>
              <p>
                Setter AI built their product for B2B sales teams that work through phone calls,
                emails, and SMS. Their AI is strong at booking meetings through outbound sequences —
                cold calls, follow-up emails, and text reminders. If that&apos;s your sales motion,
                it&apos;s a good tool.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Clinchd = Instagram DMs
              </h3>
              <p>
                Clinchd was built from scratch for coaches who generate leads through Instagram
                content. When someone comments on your Reel, replies to your Story, or DMs you
                directly, Clinchd&apos;s AI starts a natural conversation — qualifying them,
                handling objections, and booking a discovery call. It understands the Instagram
                ecosystem: how coaches post, how leads engage, and what the path from follower
                to client looks like.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Why Instagram-first matters for coaches in 2026
              </h3>
              <p>
                The data is clear: for coaches and course creators, Instagram is the #1 channel
                for warm lead generation. Over 70% of coaches report that their highest-converting
                leads come from Instagram DMs, not cold email or phone calls. Your audience is
                already on Instagram, already watching your content, and already in your DMs.
                The question isn&apos;t whether to automate your DMs — it&apos;s which tool does it best.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                Coaches don&apos;t need omnichannel — they need Instagram done right
              </h3>
              <p>
                Many AI setter tools try to be everything: phone, email, SMS, WhatsApp, Instagram.
                The result is that none of those channels get the depth they deserve. Clinchd
                deliberately focuses on one channel — Instagram DMs — and makes it exceptional.
                The AI understands coaching conversations, knows how to qualify high-ticket buyers,
                and handles the specific objections coaches hear every day. That depth is impossible
                when you&apos;re spreading across five channels.
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
                Choose Setter AI if&hellip;
              </h3>
              <ul className="space-y-3 text-stone-500 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  Your sales process runs on phone calls and cold email
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  You&apos;re in B2B sales (not coaching)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  Instagram isn&apos;t your primary lead channel
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-300 mt-1">&#8226;</span>
                  You need outbound automation (not inbound)
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
                  You&apos;re a coach or course creator on Instagram
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  Your leads come from Reels, Stories, and DMs
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  You sell high-ticket offers ($500–$5,000+)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#ff7e67] mt-1">&#8226;</span>
                  You need inbound DM automation with AI qualification
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <blockquote className="text-xl md:text-2xl font-medium text-stone-700 italic leading-relaxed mb-8">
            &ldquo;I looked at Setter AI first because the name sounded exactly like what I
            needed. But then I realized it doesn&apos;t do Instagram. All my leads come from
            Instagram — I post Reels, people DM me, and that&apos;s my entire funnel. Clinchd
            was the only tool that actually fit my workflow. First month: 31 calls booked, zero
            hours spent in DMs.&rdquo;
          </blockquote>
          <p className="font-extrabold text-stone-900">Aisha Johnson</p>
          <p className="text-sm text-stone-400 font-bold">Career Coach, 14K followers</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Setter AI vs Clinchd FAQ
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
            headline="The AI setter built for Instagram."
            subheadline="Start your 7-day free trial — no credit card required. Book your first call today."
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
            <Link href="/compare/vs-gohighlevel" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs GoHighLevel &rarr;
            </Link>
            <Link href="/blog/ai-instagram-dm-bot-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI Instagram DM Bots for Coaches &rarr;
            </Link>
            <Link href="/blog/instagram-dm-strategy-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Complete Instagram DM Strategy &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
