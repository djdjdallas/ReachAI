import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "AI DM Setter: How AI Replaces a $3K/Month Human Setter (2026)",
  description:
    "An AI DM setter qualifies your Instagram leads, handles objections, and books discovery calls 24/7. Here is how it works, what it costs, and why coaches are switching from human setters in 2026.",
  openGraph: {
    title: "AI DM Setter: How AI Replaces a $3K/Month Human Setter (2026)",
    description:
      "An AI DM setter qualifies your Instagram leads, handles objections, and books discovery calls 24/7. Here is how it works in 2026.",
    url: "https://www.clinchd.io/ai-dm-setter",
    siteName: "Clinchd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI DM Setter: How AI Replaces a $3K/Month Human Setter (2026)",
    description:
      "An AI DM setter qualifies your Instagram leads, handles objections, and books discovery calls 24/7.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/ai-dm-setter",
  },
};

const features = [
  {
    title: "Qualifies leads automatically",
    description:
      "The AI asks about goals, timeline, budget range, and fit before anyone hits your calendar. You stop wasting 30-minute calls on people looking for free advice.",
  },
  {
    title: "Handles real objections",
    description:
      "When a lead says it costs too much, that they need to think about it, or that they want to talk to their partner, the AI responds with empathy and value framing instead of a canned script.",
  },
  {
    title: "Books calls inside the conversation",
    description:
      "The AI sends your Calendly or Cal.com link at the right moment, not too soon, not too late. The lead feels ready, the call gets booked, and you wake up to a calendar that filled itself.",
  },
];

const faqs = [
  {
    q: "What is an AI DM setter?",
    a: "An AI DM setter is software that handles your Instagram DM conversations automatically. It qualifies leads by asking about budget, timeline, and fit. It handles objections like pricing hesitation or timing concerns. And when a lead is ready, it books a discovery call on your calendar through Calendly or Cal.com. It does the same job a human setter does, but 24 hours a day, for a fraction of the cost.",
  },
  {
    q: "How is an AI DM setter different from a chatbot?",
    a: "Chatbots respond to keywords. Type 'price' and they send a pre-written reply. Type 'info' and they send another. There is no understanding, no context, and no real conversation. An AI DM setter uses a language model to read what the lead actually said, weigh it against your offer and qualification criteria, and write a response that fits the moment. The difference shows up in close rate.",
  },
  {
    q: "How much does an AI DM setter cost compared to a human?",
    a: "A part-time human setter costs $2,000 to $4,000 per month. A full-time setter costs $4,000 to $8,000. An AI DM setter like Clinchd starts at $97 per month for the Base plan and $197 per month for Unlimited. The math gets clear fast: one month of a human setter pays for two years of AI.",
  },
  {
    q: "Will an AI DM setter sound like me?",
    a: "Yes, if it is set up correctly. During onboarding you provide example messages, your communication style, and the tone you want in conversations. Clinchd adapts its language to match. The AI does not sound like a generic template. It sounds like you on a good day, with no caffeine crash and no missed DMs.",
  },
  {
    q: "Is using an AI DM setter against Instagram's terms of service?",
    a: "Tools that send messages through unofficial scraping or automation libraries violate Meta's terms and risk account bans. Tools that operate through the official Instagram API with human-in-the-loop oversight are compliant. Clinchd is built on the official API and supports human takeover at any point in the conversation. That is the difference between getting flagged and getting results.",
  },
  {
    q: "How long does an AI DM setter take to set up?",
    a: "Most coaches are live in under 30 minutes. You connect your Instagram account, describe your offer and ideal client, paste in some example messages, and connect your booking link. The AI handles its first conversation the same day.",
  },
  {
    q: "Can the AI DM setter handle high-ticket sales?",
    a: "Yes. Clinchd is specifically designed for coaches selling offers from $500 to $25,000+. The AI uses qualification flows tuned for high-ticket conversations: revenue-level questions, investment readiness, decision authority, and timeline urgency. It knows how to nurture a $15K mastermind prospect differently from a $97 course buyer.",
  },
];

export default function AiDmSetterPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Clinchd",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.clinchd.io",
    description:
      "Clinchd is an AI DM setter that qualifies Instagram leads, handles objections, and books discovery calls 24/7 for coaches.",
    offers: [
      {
        "@type": "Offer",
        price: "97",
        priceCurrency: "USD",
        name: "Base Plan",
        description: "1,500 qualified conversations per month",
      },
      {
        "@type": "Offer",
        price: "197",
        priceCurrency: "USD",
        name: "Unlimited Plan",
        description: "Unlimited DM conversations",
      },
    ],
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
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqSchema} />

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-[13px] font-bold tracking-tight mb-6">
            AI DM Setter Guide (2026)
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            AI DM Setter: How AI Replaces a $3K/Month Human Setter
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            An AI DM setter qualifies your Instagram leads, handles objections, and books discovery calls 24/7. Here is how it works, what it actually costs, and why coaches are quietly replacing their human setters in 2026.
          </p>
          <p className="text-sm text-stone-400 mt-6 max-w-2xl mx-auto">
            If you're a coach selling $500-$25K offers specifically, our{" "}
            <Link href="/ai-dm-setter-for-coaches" className="font-bold text-[#ff7e67] hover:underline">
              coach-specific guide
            </Link>{" "}
            is the deeper, primary resource for your use case.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center bg-stone-900 text-white px-8 py-4 rounded-full font-bold hover:bg-[#ff7e67] transition-all shadow-sm"
            >
              Start Free Trial
            </Link>
            <Link
              href="/#pricing"
              className="text-sm font-bold text-stone-500 hover:text-stone-900"
            >
              See pricing &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Definition */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            What is an AI DM setter?
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              An AI DM setter is software that handles Instagram DM conversations automatically. It qualifies leads by asking about goals, budget, and timeline. It handles objections like pricing hesitation or timing concerns. And when a lead is ready, it books a discovery call on your calendar through Calendly or Cal.com.
            </p>
            <p>
              The {`"setter"`} part of the name comes from the traditional sales role. In coaching businesses, a human setter is someone you hire to manage your DMs, qualify incoming leads, and set (book) appointments for you. They typically cost $2,000 to $4,000 per month and work limited hours. An AI DM setter does the same job, around the clock, for under $200 per month.
            </p>
            <p>
              That cost gap is the headline. The deeper story is what an AI DM setter unlocks: every Reel that goes viral at 11 PM gets answered at 11 PM. Every comment-to-DM trigger gets a real reply, not a canned auto-response. Every qualified lead lands on your calendar with full context already gathered. The bottleneck of {"\"I will reply later\""} disappears.
            </p>
          </div>
        </div>
      </section>

      {/* Cost framing */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            The math behind the switch
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-4">
                Human DM setter
              </p>
              <p className="text-4xl font-black text-stone-900 mb-2">
                $2K – $8K<span className="text-lg font-bold text-stone-400">/mo</span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-stone-500 leading-relaxed">
                <li>Works during set hours (usually 9 to 5 EST)</li>
                <li>Sleeps when your viral Reel hits at 11 PM</li>
                <li>Needs onboarding, training, and management</li>
                <li>Quits, takes vacation, has off days</li>
                <li>Quality varies hour to hour</li>
              </ul>
            </div>
            <div className="bg-stone-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#ff7e67]/20 blur-[120px]" />
              <div className="relative z-10">
                <p className="text-sm font-bold uppercase tracking-widest text-[#ff7e67] mb-4">
                  AI DM setter (Clinchd)
                </p>
                <p className="text-4xl font-black mb-2">
                  $97 – $197<span className="text-lg font-bold text-stone-400">/mo</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm text-stone-300 leading-relaxed">
                  <li>Works 24/7, every day, every timezone</li>
                  <li>Replies in seconds, not hours</li>
                  <li>Set up in under 30 minutes</li>
                  <li>Never quits, never takes a sick day</li>
                  <li>Same quality every conversation</li>
                </ul>
              </div>
            </div>
          </div>
          <p className="text-center text-stone-500 mt-10 max-w-2xl mx-auto">
            One month of a human setter pays for nearly two years of AI. The trade-off used to be quality. In 2026, it is the opposite.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 text-center">
            How an AI DM setter actually works
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-14">
            Three jobs, run on every conversation, in the order that converts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#fff5f2] text-[#ff7e67] font-black mb-4">
                  {i + 1}
                </div>
                <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chatbot vs AI */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            AI DM setter vs basic chatbot
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Most {`"DM automation"`} on the market is keyword-triggered chat flow. Someone types {`"price"`} and the bot fires a pre-written message. Someone types {`"info"`} and a different message goes out. There is no comprehension. If a lead writes anything outside the keyword set, the conversation dies.
            </p>
            <p>
              That model worked when Instagram was forgiving and customers were patient. Neither is true anymore. Coaches who try to run a 2019-era chatbot on 2026 leads watch their close rate fall through the floor.
            </p>
            <p>
              An AI DM setter reads what the lead actually said. It weighs the message against your offer, your qualification criteria, and the conversation history. It writes a response that fits the moment. When the lead says {`"I'm not sure if this is right for me,"`} a chatbot has nothing useful to say. An AI DM setter responds the way you would, with curiosity and a question that moves the conversation forward.
            </p>
            <p>
              The shorthand: chatbots run scripts. AI DM setters run conversations.
            </p>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            Who an AI DM setter is built for
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Coaches selling $500+ offers
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                Fitness, business, life, relationship, mindset, dating, nutrition, career, wellness, and financial coaches selling programs from $500 to $25,000.
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Creators with engaged audiences
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                Anyone with 5K+ followers whose Reels and Stories drive DM volume that they cannot keep up with manually.
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Course creators and memberships
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                Operators selling cohort-based courses, memberships, or signature programs where the conversion happens in the DM, not the link in bio.
              </p>
            </div>
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                Anyone replacing a setter
              </h3>
              <p className="text-stone-500 text-sm leading-relaxed">
                If you are paying a human $2K to $8K per month to manage your DMs, you are the most obvious candidate to switch.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing reference */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6">
            Simple, flat pricing
          </h2>
          <p className="text-lg text-stone-500 font-medium mb-10 max-w-2xl mx-auto">
            No per-message fees. No contact limits that spike your bill when a Reel goes viral. Just flat monthly pricing that stays the same whether you get 50 DMs or 5,000.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">Base</p>
              <p className="text-4xl font-black text-stone-900 mb-2">$97<span className="text-lg font-bold text-stone-400">/mo</span></p>
              <p className="text-sm text-stone-500">1,500 qualified conversations/month</p>
            </div>
            <div className="bg-stone-900 rounded-[2rem] p-8 text-white">
              <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">Unlimited</p>
              <p className="text-4xl font-black mb-2">$197<span className="text-lg font-bold text-stone-400">/mo</span></p>
              <p className="text-sm text-stone-300">Unlimited DM conversations</p>
            </div>
          </div>
          <div className="mt-8">
            <Link
              href="/#pricing"
              className="text-sm font-bold text-[#ff7e67] hover:underline"
            >
              See full pricing details &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            AI DM setter FAQ
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
            headline="Ready to replace your DM setter with AI?"
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
            Related guides &amp; comparisons
          </h3>
          <div className="flex flex-wrap gap-4">
            <Link href="/ai-dm-setter-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI DM Setter for Coaches &rarr;
            </Link>
            <Link href="/instagram-dm-automation-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram DM Automation Guide &rarr;
            </Link>
            <Link href="/instagram-lead-qualification" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram Lead Qualification &rarr;
            </Link>
            <Link href="/book-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Book Discovery Calls From Instagram &rarr;
            </Link>
            <Link href="/compare/vs-setsmart" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs SetSmart &rarr;
            </Link>
            <Link href="/compare/vs-manychat" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs ManyChat &rarr;
            </Link>
            <Link href="/blog/what-is-an-ai-dm-setter" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Long read: What Is an AI DM Setter? &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
