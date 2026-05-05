import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "How to Book Discovery Calls From Instagram (2026)",
  description:
    "The 5-stage funnel coaches use to turn Instagram followers into booked discovery calls. Manual playbook, AI-automated playbook, and Calendly + Cal.com setup notes.",
  openGraph: {
    title: "How to Book Discovery Calls From Instagram (2026)",
    description:
      "The 5-stage funnel coaches use to turn Instagram followers into booked discovery calls.",
    url: "https://www.clinchd.io/book-discovery-calls-from-instagram",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Book Discovery Calls From Instagram (2026)",
    description:
      "The 5-stage funnel coaches use to turn Instagram followers into booked discovery calls.",
  },
  alternates: {
    canonical:
      "https://www.clinchd.io/book-discovery-calls-from-instagram",
  },
};

const funnel = [
  {
    stage: "1. Awareness",
    description:
      "A follower sees your Reel, Story, or post. They feel something: recognition, hope, urgency. The window opens.",
    losePoint:
      "Your content didn't name a specific problem clearly enough to make them DM. Fix: tighten your hook to a single, specific pain point per post.",
  },
  {
    stage: "2. DM open",
    description:
      "They send a message. {`'How does your program work?'`} or {`'How much?'`} or just an emoji and a follow-back.",
    losePoint:
      "You replied 8 hours later. The emotional momentum is gone. Fix: reply within 5 minutes, or use an AI DM setter that does it for you.",
  },
  {
    stage: "3. Qualification",
    description:
      "You ask the right questions in the right order. Goal, timeline, past attempts, investment range. They share enough for you to know whether they're a fit.",
    losePoint:
      "You either booked the call too early (and got ghosted) or asked 6 questions in a row (and felt like a salesperson). Fix: one question per turn, mirror their language, ladder up to investment last.",
  },
  {
    stage: "4. Book",
    description:
      "You send your Calendly or Cal.com link inside the conversation. They click. They pick a time. The call hits your calendar.",
    losePoint:
      "You sent a generic link with no context, or you sent it too soon before they were ready. Fix: send the link with one sentence of context about what the call covers, only after the lead has signaled buying intent.",
  },
  {
    stage: "5. Show",
    description:
      "They actually show up to the call. You have full context. The call goes deep, fast.",
    losePoint:
      "No reminder, no context, no warmth between booking and showing. They forgot, got cold feet, or rebooked elsewhere. Fix: automated reminders, a warm pre-call DM the day before, and your Calendly setup includes a reschedule link.",
  },
];

const faqs = [
  {
    q: "How many discovery calls should I book per month from Instagram?",
    a: "It depends on your audience size and content cadence. As a benchmark, coaches with 5K-20K engaged followers and 3-5 posts per week typically book 12-30 discovery calls per month with manual replies, and 25-60 with an AI DM setter handling the qualifying flow. The biggest variable is response time, not follower count.",
  },
  {
    q: "Should I send my Calendly link in the first DM?",
    a: "No, unless the lead explicitly asks for it. Sending the booking link before qualification leads to no-shows and unqualified calls. The pattern that works: 3-6 message exchanges of qualification first, then send the link with one sentence of context about what the call covers.",
  },
  {
    q: "What's better, Calendly or Cal.com?",
    a: "Both work. Calendly has more polish and better integrations. Cal.com is open source, cheaper at scale, and more customizable. Clinchd integrates with both natively. Pick whichever you already use; switching tools is rarely worth the friction.",
  },
  {
    q: "How do I increase my discovery call show rate?",
    a: "The biggest lever is the booking experience itself. Automated reminders 24h and 1h before. A warm pre-call DM the day before that confirms the call and adds context. A simple reschedule link in case life happens. Coaches who add these three things see show rates climb from ~60% to 80%+.",
  },
  {
    q: "Can I automate the entire booking process?",
    a: "Yes. Clinchd qualifies leads in DMs and drops your Calendly or Cal.com link inside the conversation when the lead is ready. The booking, the reminder, and the calendar invite all happen automatically. You wake up to a calendar full of qualified, pre-warmed discovery calls.",
  },
];

export default function BookDiscoveryCallsFromInstagramPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Book Discovery Calls From Instagram (2026)",
    description:
      "The 5-stage funnel coaches use to turn Instagram followers into booked discovery calls.",
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
      "@id":
        "https://www.clinchd.io/book-discovery-calls-from-instagram",
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

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Book Discovery Calls From Instagram",
    step: funnel.map((stage, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: stage.stage,
      text: stage.description,
    })),
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={howToSchema} />

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            How-To Pillar
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            How to Book Discovery Calls From Instagram (2026)
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Every Instagram follower walks through 5 stages before they show up on your Zoom. Skipping any one of them is why most coaches get ghosted. Here is the full funnel, where coaches lose calls at each stage, and the AI version that closes the gap.
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

      {/* The funnel */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 text-center">
            The 5-stage Instagram-to-call funnel
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-14">
            Awareness → DM Open → Qualification → Book → Show. Coaches who track each stage know exactly where they leak calls.
          </p>
          <div className="space-y-6">
            {funnel.map((stage) => (
              <div
                key={stage.stage}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <h3 className="text-xl font-extrabold text-stone-900 mb-4">
                  {stage.stage}
                </h3>
                <p className="text-stone-600 leading-relaxed mb-4">
                  {stage.description}
                </p>
                <div className="bg-[#fff5f2] rounded-2xl p-5 border border-[#ff7e67]/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-2">
                    Where coaches lose
                  </p>
                  <p className="text-sm text-stone-700 leading-relaxed">{stage.losePoint}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manual playbook */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            The manual playbook
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              For coaches without automation, the workflow is roughly: post 3-5 times a week, watch DMs all day, reply within 30-60 minutes when possible, ask qualifying questions across 5-8 message exchanges, send the Calendly link when the lead is qualified, and follow up the day before to confirm.
            </p>
            <p>
              It works. Coaches with strong content and disciplined DM hygiene book 12-30 discovery calls per month this way. The cost is the time. Two to three hours per day is typical, and the response-time leakage is brutal: every DM that waits more than an hour drops conversion 3x. Every DM that waits more than a day drops it 5-10x.
            </p>
            <p>
              The manual playbook is the right starting point. It teaches you what your audience actually asks, what objections come up, and what conversational patterns convert. After 2-3 months of doing it manually, you have everything you need to write a great AI playbook.
            </p>
          </div>
        </div>
      </section>

      {/* AI playbook */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            The AI-automated playbook
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Once you know the conversational patterns that convert, an AI DM setter runs the same playbook 24/7. It replies within seconds, qualifies on budget, timeline, fit, and urgency, and drops your Calendly link inside the conversation when the lead is ready. You stop doing the work and start showing up to the calls.
            </p>
            <p>
              Clinchd is the AI DM setter built for this exact job. During setup you describe your offer, ideal client, and the qualifying questions you want asked. The AI runs the full conversation flow. When a lead hits all four BTFU dimensions (budget, timeline, fit, urgency), it sends your booking link with one sentence of context. When they don't, it nurtures or politely closes the loop.
            </p>
            <p>
              Coaches who switch typically see discovery call volume go up 2-3x in the first 30 days, with no extra effort. The lift comes from response time alone: every DM gets answered within seconds instead of hours.
            </p>
          </div>
        </div>
      </section>

      {/* Calendly setup */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            Calendly &amp; Cal.com setup notes
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Both tools work great for coaching discovery calls. Calendly has the polish and the most integrations. Cal.com is open source, cheaper at scale, and more customizable. Whatever you pick, get the basics right:
            </p>
            <ul className="list-disc pl-6 space-y-3">
              <li>
                <strong className="text-stone-900">25-30 minute discovery call.</strong> Long enough to qualify, short enough to respect their time.
              </li>
              <li>
                <strong className="text-stone-900">2-3 questions on the booking form.</strong> {`"What is your goal?"`} {`"What have you tried?"`} {`"Anything I should know before the call?"`} Pulls full context to your inbox before the call starts.
              </li>
              <li>
                <strong className="text-stone-900">Automated reminders at 24h and 1h.</strong> Email + SMS if possible.
              </li>
              <li>
                <strong className="text-stone-900">Reschedule link in every email.</strong> Life happens. The easier you make it to reschedule, the higher your show rate.
              </li>
              <li>
                <strong className="text-stone-900">Buffer time between calls.</strong> 15 minutes minimum. Discovery calls run over.
              </li>
              <li>
                <strong className="text-stone-900">Same-day availability turned ON for emergencies.</strong> A high-intent lead who wants to book today is your best lead. Don't make them wait 3 days.
              </li>
            </ul>
            <p>
              Clinchd integrates with both natively. The AI sends your booking link inside the DM, the lead picks a time, and the call lands on your calendar with full context.
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
            headline="Want a calendar full of qualified calls?"
            subheadline="Start your 7-day free trial. Connects with Calendly and Cal.com. Set up in under 30 minutes."
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
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI DM Setter for Coaches &rarr;
            </Link>
            <Link href="/instagram-lead-qualification" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram Lead Qualification &rarr;
            </Link>
            <Link href="/instagram-dm-automation-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram DM Automation Guide &rarr;
            </Link>
            <Link href="/blog/how-to-book-more-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Long read: How to book more discovery calls &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
