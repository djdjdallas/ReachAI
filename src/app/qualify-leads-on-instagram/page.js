import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "How to Qualify Leads on Instagram (2026 Method for Coaches)",
  description:
    "How to qualify leads on Instagram in 2026. The exact DM questions, qualification frameworks, and AI workflows coaches use to fill calendars with high-ticket prospects.",
  openGraph: {
    title: "How to Qualify Leads on Instagram (2026 Method for Coaches)",
    description:
      "The exact DM questions, qualification frameworks, and AI workflows coaches use in 2026.",
    url: "https://www.clinchd.io/qualify-leads-on-instagram",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Qualify Leads on Instagram (2026 Method for Coaches)",
    description:
      "The exact DM questions, qualification frameworks, and AI workflows coaches use in 2026.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/qualify-leads-on-instagram",
  },
};

const sampleQuestions = [
  {
    category: "Opening",
    examples: [
      "What's going on in your business / training / life that prompted you to reach out?",
      "What does success look like for you 6 months from now?",
      "What have you already tried before reaching out today?",
    ],
  },
  {
    category: "Budget signal",
    examples: [
      "What kind of investment range have you been thinking about for solving this?",
      "Is this something you're looking to handle DIY or work with a coach on?",
      "Have you worked with a coach in this area before? What was that like?",
    ],
  },
  {
    category: "Timeline signal",
    examples: [
      "When are you hoping to make progress on this?",
      "Is there a deadline or moment that triggered you reaching out?",
      "Are you ready to start this month, or are you researching for later?",
    ],
  },
  {
    category: "Fit + urgency",
    examples: [
      "What feels like the biggest blocker right now?",
      "If nothing changes in the next 90 days, what does that look like?",
      "What would it mean to you to actually solve this?",
    ],
  },
];

const faqs = [
  {
    q: "How do I qualify leads on Instagram without sounding like a salesperson?",
    a: "Lead with curiosity, not a script. Ask one question per turn, mirror the lead's language, and build on their answers. The order that works: acknowledge the moment they reached out → ask about their goal → ask about timeline → ask about what they have tried → ask about investment range → suggest a call.",
  },
  {
    q: "What's the fastest way to filter tire-kickers from real buyers?",
    a: "Ask about timeline and what triggered the reach-out. A real buyer has urgency: they got a new role, hit a deadline, watched a Reel that named their exact problem. A tire-kicker is just curious. The urgency question separates the two faster than any other.",
  },
  {
    q: "Should I ask about budget in DMs?",
    a: "Yes, but indirectly. Don't ask {`'what's your budget?'`} in the second message. Ask about investment ranges they've considered, what they've spent on coaching before, or whether they're looking to DIY or work with someone. Same information, way less friction.",
  },
  {
    q: "Can I automate this whole process?",
    a: "Yes, with an AI DM setter built for coaches. The AI runs the qualifying questions, listens to responses, and books calls only when the lead hits your criteria. Clinchd is built for this exact job. Setup takes about 30 minutes, calibration takes a week, and after that the qualification runs itself.",
  },
  {
    q: "How is this different from the BANT framework?",
    a: "BANT (Budget, Authority, Need, Timeline) was built for B2B SaaS sales. For coaching, we use BTFU: Budget, Timeline, Fit, Urgency. Authority matters less because most coaching buyers are individuals making their own decision. Urgency matters more because coaching is an emotionally driven purchase.",
  },
];

export default function QualifyLeadsOnInstagramPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Qualify Leads on Instagram (2026 Method for Coaches)",
    description:
      "The exact DM questions, qualification frameworks, and AI workflows coaches use in 2026.",
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
      "@id": "https://www.clinchd.io/qualify-leads-on-instagram",
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
            How-To Guide
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            How to Qualify Leads on Instagram
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            The exact questions, frameworks, and conversation flows that turn an Instagram DM into a qualified discovery call. With copy-paste prompts you can use today and notes on how to automate the whole thing.
          </p>
          <p className="text-sm text-stone-400 mt-6 max-w-2xl mx-auto">
            This is the hands-on how-to. For the full playbook (the BTFU framework explained in depth, the 4 qualification methods compared, and how each manual method breaks at scale), see our{" "}
            <Link href="/instagram-lead-qualification" className="font-bold text-[#ff7e67] hover:underline">
              complete Instagram Lead Qualification playbook
            </Link>.
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

      {/* Manual playbook */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            The manual playbook
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              When a lead DMs you about your coaching offer, you have roughly 5 to 8 message exchanges to qualify them before either booking a call or politely closing the loop. Move too fast and the conversation feels transactional. Move too slow and you ghost yourself.
            </p>
            <p>
              The flow that works: acknowledge → goal → timeline → past attempts → investment signal → call invite. One question per turn, never more than two. Mirror their language. Use their words back to them. Treat the conversation like a coaching session, not a survey.
            </p>
            <p>
              The questions below are field-tested across 200+ coaches and are the actual phrasings that get the highest response rates. Adapt them to your voice, but the structure works.
            </p>
          </div>
        </div>
      </section>

      {/* Sample questions */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            Copy-paste qualifying questions
          </h2>
          <div className="space-y-6">
            {sampleQuestions.map((group) => (
              <div
                key={group.category}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-4">
                  {group.category}
                </p>
                <ul className="space-y-3">
                  {group.examples.map((q) => (
                    <li key={q} className="flex items-start gap-3">
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#ff7e67]" />
                      <p className="text-stone-700 leading-relaxed font-medium">{q}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BTFU Framework */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            The BTFU framework (replaces BANT for coaching)
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              BANT (Budget, Authority, Need, Timeline) was built for B2B SaaS. It assumes a procurement process and a chain of decision-makers. Coaching sales don't work that way. The buyer is usually the decision-maker, but the {`"need"`} is emotionally loaded and the urgency is what actually drives the close.
            </p>
            <p>
              For coaching, use <strong className="text-stone-900">BTFU</strong>: Budget, Timeline, Fit, Urgency. Authority is replaced by Urgency because coaching is an individual decision driven by a triggering moment, not a committee approval. Need is replaced by Fit because coaches don't sell a thing, they sell a relationship, and fit is what makes that relationship work.
            </p>
            <p>
              Ask about all four dimensions, in any order, woven through the conversation. When all four are positive, send the booking link. When one is missing, nurture. When two or more are negative, politely close the loop and stay in touch.
            </p>
            <div className="bg-white rounded-2xl p-6 border border-stone-100 mt-6">
              <p className="text-sm text-stone-700 font-medium leading-relaxed">
                Want the full breakdown of all four dimensions?{" "}
                <Link
                  href="/instagram-lead-qualification"
                  className="font-bold text-[#ff7e67] hover:underline"
                >
                  Read the full Instagram Lead Qualification playbook &rarr;
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AI version */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            How to automate the whole thing
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Manual DM qualification works. It also burns out coaches who try to scale it. The hour you spent qualifying 12 DMs this morning is an hour you didn't spend coaching paying clients, recording content, or living your life. The math gets worse as your audience grows.
            </p>
            <p>
              An AI DM setter built for coaches runs the qualification flow 24/7. It asks the same questions in the same order, mirrors the lead's language, and books calls only when the lead is qualified on budget, timeline, fit, and urgency. Clinchd is built for this exact job: setup takes 30 minutes, calibration takes a week, and after that the qualification runs without you watching.
            </p>
            <p>
              The trade-off used to be quality. With a real AI DM setter (not a keyword chatbot), it's the opposite: you get the highest signal AND the fastest response. That's why the math has shifted decisively toward automation in 2026.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            FAQ
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
            headline="Stop spending mornings qualifying DMs by hand"
            subheadline="Start your 7-day free trial. The AI runs your qualifying flow 24/7. Set up in under 30 minutes."
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
            <Link href="/instagram-lead-qualification" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Full Lead Qualification Playbook &rarr;
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
          </div>
        </div>
      </section>
    </>
  );
}
