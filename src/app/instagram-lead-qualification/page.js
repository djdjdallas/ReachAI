import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Instagram Lead Qualification: The 2026 Playbook for Coaches",
  description:
    "How to qualify Instagram leads on budget, timeline, fit, and urgency. Compare manual methods (DM, Stories polls, comments) and the AI version that runs in real time.",
  openGraph: {
    title: "Instagram Lead Qualification: The 2026 Playbook for Coaches",
    description:
      "How to qualify Instagram leads on budget, timeline, fit, and urgency. The full playbook for 2026.",
    url: "https://www.clinchd.io/instagram-lead-qualification",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Instagram Lead Qualification: The 2026 Playbook for Coaches",
    description:
      "How to qualify Instagram leads on budget, timeline, fit, and urgency. The full playbook for 2026.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/instagram-lead-qualification",
  },
};

const dimensions = [
  {
    title: "Budget",
    description:
      "Can the lead afford your offer? You don't need to know their bank balance. You need to know whether your $5K to $25K program is in the realm of possibility for them. Ask about current revenue, business stage, or what they have invested in coaching before.",
  },
  {
    title: "Timeline",
    description:
      "When do they want to start? A lead who wants to move next month converts at a different rate than someone {\"just researching.\"} Timeline tells you how to weight the conversation: book a call now, nurture for 2 weeks, or politely close the loop.",
  },
  {
    title: "Fit",
    description:
      "Is your offer actually the right thing for what they need? A lead asking for something you don't sell is not a lost lead. They are a referral opportunity, or a polite goodbye. Fit qualification keeps your calendar clean of mismatched calls.",
  },
  {
    title: "Urgency",
    description:
      "Why now? The strongest leads have a triggering event: a new role, a recent failure, a deadline, a moment of clarity. Without urgency, even a high-budget high-fit prospect drifts. Asking the urgency question is the single highest-leverage qualifying move.",
  },
];

const methods = [
  {
    title: "DM-based qualification",
    bestFor: "High-ticket coaching ($1K+)",
    pro: "Highest signal. Real conversation, real context, full nuance.",
    con: "Slow if you do it manually. Misses leads outside business hours. Burns out the coach.",
  },
  {
    title: "Stories polls and quizzes",
    bestFor: "Top-of-funnel filtering",
    pro: "Low effort. Gets large groups to self-segment.",
    con: "No depth. Cannot distinguish a serious buyer from a curious follower.",
  },
  {
    title: "Comment filters and lead magnets",
    bestFor: "List building",
    pro: "Captures emails. Works at scale.",
    con: "Pulls leads off Instagram into a slower email funnel. Loses the urgency that made them comment in the first place.",
  },
  {
    title: "AI-driven DM qualification",
    bestFor: "Coaches with viral content or 5K+ engaged followers",
    pro: "Highest signal AND fastest response. Runs 24/7. Scales without burnout.",
    con: "Requires 30 minutes of setup and a 7-day calibration window.",
  },
];

const faqs = [
  {
    q: "What does {'lead qualification'} actually mean for an Instagram coach?",
    a: "It means filtering people who DM you so you only spend time on calls with serious, qualified prospects. The four dimensions that matter for coaching are budget, timeline, fit, and urgency. You qualify by asking the right questions in the right order and listening for buying signals before you book the call.",
  },
  {
    q: "How many qualifying questions are too many?",
    a: "More than 5 to 7 starts to feel like an interrogation in a DM. The trick is to weave qualification into a real conversation. Ask one or two per turn, mirror what the lead says, and build on their answers. An AI DM setter does this automatically and never asks redundant questions.",
  },
  {
    q: "Should I qualify on price before I send my booking link?",
    a: "Yes, almost always, for offers above $1K. Booking calls with people who cannot afford your offer wastes everyone's time. The exception: if your offer has a tiered ladder ($97 → $497 → $5K), it can make sense to skip price qualification and let the call itself sort it.",
  },
  {
    q: "What if a lead refuses to share budget?",
    a: "That is a qualifier in itself. Coaches who say {`'no budget questions in DMs'`} usually attract a higher percentage of tire-kickers. The AI handles this gracefully: if a lead pushes back on a budget question, the AI pivots to fit and timeline, and only revisits investment after the lead expresses real intent.",
  },
  {
    q: "Can lead qualification be fully automated?",
    a: "Yes, with a real AI DM setter (not a keyword chatbot). The AI asks qualification questions, reads the responses, weighs them against your criteria, and either books a call, nurtures, or politely declines. Human-in-the-loop oversight keeps you in control of edge cases.",
  },
];

export default function InstagramLeadQualificationPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "Instagram Lead Qualification: The 2026 Playbook for Coaches",
    description:
      "How to qualify Instagram leads on budget, timeline, fit, and urgency.",
    datePublished: "2026-05-04",
    dateModified: "2026-05-04",
    author: {
      "@type": "Organization",
      name: "Clinchd",
      url: "https://www.clinchd.io",
    },
    publisher: {
      "@type": "Organization",
      name: "Clinchd",
      url: "https://www.clinchd.io",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": "https://www.clinchd.io/instagram-lead-qualification",
    },
  };

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
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            Lead Qualification Playbook
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Instagram Lead Qualification: The 2026 Playbook for Coaches
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Most coaches treat every DM the same. The ones with full calendars don't. They qualify on four dimensions before a single call gets booked. Here is exactly how, and how to automate the parts that drain your time.
          </p>
          <div className="mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center bg-stone-900 text-white px-8 py-4 rounded-full font-bold hover:bg-[#ff7e67] transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* What is qualification */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            What lead qualification means in DMs
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Lead qualification is the work of filtering people who reach out so that you only spend time on calls with serious, qualified prospects. In a B2B sales process this looks like a discovery form and an SDR. In a coaching business on Instagram, it looks like a DM conversation.
            </p>
            <p>
              The challenge is that DM qualification has to feel like a conversation, not an interrogation. A lead reached out because something you said resonated. The qualification questions have to be woven into a real exchange that respects the moment, mirrors their language, and moves the conversation forward.
            </p>
            <p>
              Coaches who are bad at DM qualification do one of two things. They either book every call (wasting hours on tire-kickers) or they fire off a list of questions like a CRM form (killing the conversation before it starts). Coaches who are good at it ask one or two qualifying questions per turn, listen for the answer, and adjust the next move.
            </p>
          </div>
        </div>
      </section>

      {/* 4 dimensions */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 text-center">
            The 4 qualifying dimensions for coaching
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-14">
            Most {`"BANT"`} frameworks were built for B2B SaaS. Coaching is different. These four dimensions are what actually matter when you are selling a $500 to $25K transformation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {dimensions.map((d, i) => (
              <div
                key={d.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#fff5f2] text-[#ff7e67] font-black mb-4">
                  {i + 1}
                </div>
                <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                  {d.title}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">
                  {d.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Methods comparison */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 text-center">
            The 4 methods coaches use to qualify
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-14">
            Each works in some context. Most coaches use a combination, anchored by DM conversation.
          </p>
          <div className="space-y-6">
            {methods.map((m) => (
              <div
                key={m.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
                  <h3 className="text-lg font-extrabold text-stone-900">{m.title}</h3>
                  <span className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] bg-[#fff5f2] rounded-full px-3 py-1">
                    Best for: {m.bestFor}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">
                      Strength
                    </p>
                    <p className="text-sm text-stone-700 leading-relaxed">{m.pro}</p>
                  </div>
                  <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                      Limitation
                    </p>
                    <p className="text-sm text-stone-700 leading-relaxed">{m.con}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI version */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            The AI-driven version
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Manual DM qualification has the highest signal but the worst scale. Stories polls and lead magnets scale beautifully but lose the depth that makes coaching sales work. The version coaches are switching to in 2026 is AI-driven DM qualification: highest signal AND fastest response, running 24/7.
            </p>
            <p>
              Clinchd is the AI DM setter built for this exact job. During setup you describe your offer, ideal client, and qualifying criteria. The AI then runs real conversations: it acknowledges the lead's message, asks one qualifying question per turn, listens to the response, and adjusts. When the lead is qualified on all four dimensions (budget, timeline, fit, urgency), it sends your Calendly link inside the conversation. When they're not, it nurtures or politely closes the loop.
            </p>
            <p>
              The result: every qualified lead lands on your calendar with full context already gathered, and every unqualified lead gets a respectful response that keeps your reputation clean. No more 30-minute discovery calls with people looking for free advice.
            </p>
            <div className="bg-[#fff5f2] rounded-2xl p-6 border border-[#ff7e67]/20 mt-6">
              <p className="text-sm text-stone-700 font-medium leading-relaxed">
                <strong className="text-stone-900">See it in action:</strong> Clinchd qualifies on all 4 dimensions automatically.{" "}
                <Link
                  href="/ai-dm-setter-for-coaches"
                  className="font-bold text-[#ff7e67] hover:underline"
                >
                  Read about the AI DM setter for coaches &rarr;
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Lead qualification FAQ
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
            headline="Ready to qualify leads automatically?"
            subheadline="Start your 7-day free trial. No credit card required. Set up in under 30 minutes."
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
            Related guides
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/qualify-leads-on-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Qualify Leads on Instagram (variant guide) &rarr;
            </Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI DM Setter for Coaches &rarr;
            </Link>
            <Link href="/book-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Book Discovery Calls From Instagram &rarr;
            </Link>
            <Link href="/instagram-dm-automation-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram DM Automation Guide &rarr;
            </Link>
            <Link href="/blog/how-to-qualify-leads-on-instagram-dms" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Long read: How to qualify leads on Instagram DMs &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
