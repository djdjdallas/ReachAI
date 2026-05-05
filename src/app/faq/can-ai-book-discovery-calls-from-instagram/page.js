import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Can AI Book Discovery Calls From Instagram? (Yes, Here's How)",
  description:
    "Yes, AI can book discovery calls from Instagram. Tools like Clinchd integrate with Calendly and Cal.com to send booking links inside the DM conversation when a lead is qualified.",
  openGraph: {
    title: "Can AI Book Discovery Calls From Instagram? (Yes, Here's How)",
    description:
      "Yes, AI can book discovery calls from Instagram. Here is how it actually works.",
    url: "https://www.clinchd.io/faq/can-ai-book-discovery-calls-from-instagram",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Can AI Book Discovery Calls From Instagram? (Yes, Here's How)",
    description: "Yes, AI can book discovery calls from Instagram.",
  },
  alternates: {
    canonical:
      "https://www.clinchd.io/faq/can-ai-book-discovery-calls-from-instagram",
  },
};

const question = "Can AI book discovery calls from Instagram?";
const directAnswer =
  "Yes. AI tools like Clinchd integrate with Calendly and Cal.com to send booking links inside the DM conversation when a lead is qualified. The AI handles the qualifying questions, reads buying signals, drops the link at the right moment, and books the call directly to your calendar.";

export default function FaqCanAiBookDiscoveryCalls() {
  const qaSchema = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question,
      text: question,
      answerCount: 1,
      acceptedAnswer: {
        "@type": "Answer",
        text: directAnswer,
        url: "https://www.clinchd.io/faq/can-ai-book-discovery-calls-from-instagram",
      },
    },
  };

  return (
    <>
      <JsonLd data={qaSchema} />

      {/* Hero */}
      <section className="pt-20 pb-8 md:pt-32 md:pb-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/"
              className="text-sm font-bold text-[#ff7e67] hover:underline"
            >
              &larr; Clinchd
            </Link>
          </div>
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            Quick Answer
          </span>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Can AI book discovery calls from Instagram?
          </h1>
          <div className="bg-[#fff5f2] rounded-[2rem] border border-[#ff7e67]/20 p-8 md:p-10 mb-10">
            <p className="text-lg md:text-xl text-stone-700 font-medium leading-relaxed">
              {directAnswer}
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-8 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mb-4">
            How the booking actually works
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              The lead DMs you. The AI replies in seconds, asks qualifying questions about goals, timeline, and investment readiness. As the conversation progresses, the AI weighs the responses against your qualifying criteria. When the lead hits the threshold (and signals buying intent), the AI sends your Calendly or Cal.com link with one sentence of context about what the call covers.
            </p>
            <p>
              The lead clicks the link, picks a time, and the call lands on your calendar with full context already in the booking notes. You get a notification, the lead gets reminders, and the AI continues the conversation if they have follow-up questions before the call.
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-stone-900 mt-10 mb-4">
            Success metrics
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Coaches using AI to book discovery calls typically see 2-3x more booked calls in the first 30 days compared to manual replies. The lift comes from response time: every DM is answered in seconds instead of hours, and the qualifying flow runs 24/7 without breaks.
            </p>
            <p>
              Show rates also tend to climb. The lead is qualified before they book, the AI sends a warm pre-call message the day before, and the booking experience comes through automated reminders. Show rates above 80% are common for coaches who set this up correctly.
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-stone-900 mt-10 mb-4">
            What it integrates with
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Clinchd works natively with Calendly and Cal.com, the two most popular booking tools for coaches. The integration is one-click in the dashboard. After connecting, the AI uses your existing event types and availability without any extra configuration.
            </p>
            <p>
              <Link href="/book-discovery-calls-from-instagram" className="font-bold text-[#ff7e67] hover:underline">
                Read the full guide on booking discovery calls from Instagram &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Related FAQs */}
      <section className="py-12 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-6">
            Related questions
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/faq/what-is-an-ai-dm-setter" className="text-sm font-bold text-[#ff7e67] hover:underline">
              What is an AI DM setter? &rarr;
            </Link>
            <Link href="/faq/how-much-does-a-human-dm-setter-cost" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How much does a human DM setter cost? &rarr;
            </Link>
            <Link href="/faq/how-fast-should-you-respond-to-instagram-dms" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How fast should you respond to Instagram DMs? &rarr;
            </Link>
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI DM Setter for Coaches &rarr;
            </Link>
            <Link href="/compare/best-ai-dm-tool-for-coaches-2026" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Best AI DM tool for coaches 2026 &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="See AI book discovery calls in action"
            subheadline="Start your 7-day free trial. Connects with Calendly and Cal.com. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>
    </>
  );
}
