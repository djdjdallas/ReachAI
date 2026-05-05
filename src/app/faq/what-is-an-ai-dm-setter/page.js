import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "What Is an AI DM Setter? (Plain-English Definition for 2026)",
  description:
    "An AI DM setter is software that qualifies your Instagram leads, handles objections, and books discovery calls 24/7. Here is a clear definition, how it differs from chatbots, and what it costs.",
  openGraph: {
    title: "What Is an AI DM Setter? (Plain-English Definition for 2026)",
    description:
      "An AI DM setter qualifies Instagram leads, handles objections, and books discovery calls 24/7. Plain-English definition.",
    url: "https://www.clinchd.io/faq/what-is-an-ai-dm-setter",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "What Is an AI DM Setter? (Plain-English Definition for 2026)",
    description:
      "Plain-English definition of an AI DM setter, how it differs from chatbots, and what it costs.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/faq/what-is-an-ai-dm-setter",
  },
};

const question = "What is an AI DM setter?";
const directAnswer =
  "An AI DM setter is software that handles your Instagram DM conversations automatically. It qualifies leads, handles objections, and books discovery calls on your calendar 24/7, replacing the work a human DM setter would do at a fraction of the cost.";

export default function FaqWhatIsAnAiDmSetter() {
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
        url: "https://www.clinchd.io/faq/what-is-an-ai-dm-setter",
      },
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: question,
        acceptedAnswer: {
          "@type": "Answer",
          text: directAnswer,
        },
      },
      {
        "@type": "Question",
        name: "How is an AI DM setter different from a chatbot?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Chatbots respond to keywords with pre-written messages. AI DM setters use a language model to read each message in context and write a real response. The result is conversations that actually convert, not scripts that die when a lead goes off-keyword.",
        },
      },
      {
        "@type": "Question",
        name: "What does an AI DM setter cost?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "AI DM setters typically cost $97 to $197 per month for unlimited conversations. A human DM setter costs $2,000 to $4,000 per month for part-time work and $4,000 to $8,000 for full-time.",
        },
      },
    ],
  };

  return (
    <>
      <JsonLd data={qaSchema} />
      <JsonLd data={faqSchema} />

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
            What is an AI DM setter?
          </h1>
          <div className="bg-[#fff5f2] rounded-[2rem] border border-[#ff7e67]/20 p-8 md:p-10 mb-10">
            <p className="text-lg md:text-xl text-stone-700 font-medium leading-relaxed">
              {directAnswer}
            </p>
          </div>
        </div>
      </section>

      {/* How it differs from chatbots */}
      <section className="py-8 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold text-stone-900 mt-6 mb-4">
            How it differs from a chatbot
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              A chatbot responds to keywords. Type {`"price"`} and it sends a pre-written message. Type {`"info"`} and it sends another. There is no real understanding, and the conversation dies the moment a lead writes anything outside the keyword set.
            </p>
            <p>
              An AI DM setter uses a language model. It reads what the lead actually said, weighs it against your offer and qualification criteria, and writes a response that fits the moment. The shorthand: chatbots run scripts. AI DM setters run conversations.
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-stone-900 mt-10 mb-4">
            Who uses one
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              Coaches, course creators, and consultants who sell offers from $500 to $25,000+ on Instagram. Anyone whose audience generates more DMs than they can personally answer in a day. Anyone currently paying $2K-$8K per month for a human setter and looking for the math to make sense.
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-stone-900 mt-10 mb-4">
            Typical pricing
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              AI DM setters generally fall in the $97 to $197 per month range for unlimited conversations. Compared to a human setter at $2,000 to $4,000 per month for part-time work, the math is the headline. One month of a human setter pays for almost two years of AI.
            </p>
            <p>
              <Link href="/faq/how-much-does-a-human-dm-setter-cost" className="font-bold text-[#ff7e67] hover:underline">
                See full cost breakdown for human DM setters &rarr;
              </Link>
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-stone-900 mt-10 mb-4">
            Going deeper
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed">
            <p>
              For the full breakdown including a real coaching example, what to look for in an AI DM setter, and how the technology actually works,{" "}
              <Link href="/blog/what-is-an-ai-dm-setter" className="font-bold text-[#ff7e67] hover:underline">
                read the long-form article &rarr;
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
            <Link href="/faq/how-much-does-a-human-dm-setter-cost" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How much does a human DM setter cost? &rarr;
            </Link>
            <Link href="/faq/can-ai-book-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Can AI book discovery calls from Instagram? &rarr;
            </Link>
            <Link href="/faq/how-fast-should-you-respond-to-instagram-dms" className="text-sm font-bold text-[#ff7e67] hover:underline">
              How fast should you respond to Instagram DMs? &rarr;
            </Link>
            <Link href="/ai-dm-setter" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Full AI DM Setter Guide &rarr;
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
            headline="See an AI DM setter in action"
            subheadline="Start your 7-day free trial. No credit card required. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>
    </>
  );
}
