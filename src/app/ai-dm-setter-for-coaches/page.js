import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "AI DM Setter for Coaches: Qualify Leads & Book Calls 24/7 (2026)",
  description:
    "The AI DM setter built for coaches selling $500 to $25K offers. Qualify Instagram leads on budget, timeline, and fit, handle real coaching objections, and book discovery calls automatically.",
  openGraph: {
    title: "AI DM Setter for Coaches: Qualify Leads & Book Calls 24/7 (2026)",
    description:
      "The AI DM setter built for coaches. Qualify Instagram leads, handle objections, book discovery calls automatically.",
    url: "https://www.clinchd.io/ai-dm-setter-for-coaches",
    siteName: "Clinchd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI DM Setter for Coaches: Qualify Leads & Book Calls 24/7 (2026)",
    description:
      "The AI DM setter built for coaches. Qualify Instagram leads, handle objections, book discovery calls.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/ai-dm-setter-for-coaches",
  },
};

const features = [
  {
    title: "Built only for coaches",
    description:
      "Every objection script, qualification flow, and tone preset is tuned for the way coaches actually sell on Instagram. No agency features, no e-commerce flows, no general-purpose dilution.",
  },
  {
    title: "High-ticket aware",
    description:
      "The AI knows the difference between a $97 course buyer and a $15K mastermind prospect. It qualifies on revenue level, business stage, and investment readiness instead of asking everyone the same generic questions.",
  },
  {
    title: "Calendly + Cal.com native",
    description:
      "When the lead is ready, the AI drops your booking link inside the conversation. It reads the buying signals and chooses the moment, instead of pushing the link in message two like every chatbot does.",
  },
];

const objectionExamples = [
  {
    objection: "How much is it?",
    badResponse: "It's $5,000.",
    aiResponse: "Great question. Before I share investment details, can I ask what stage your business is at and what kind of result you are looking for in the next 6 months? I want to make sure I share the right option.",
  },
  {
    objection: "I need to think about it.",
    badResponse: "OK, let me know.",
    aiResponse: "Totally get it. When you say 'think about it,' is it more about the timing, the fit, or the investment? I have helped coaches at every stage of that decision and I am happy to share what tipped them either way.",
  },
  {
    objection: "I need to talk to my partner.",
    badResponse: "Sure, get back to me.",
    aiResponse: "Of course. Most of my clients had the same conversation with their partner. Would it help if I gave you a quick summary of what we cover and the typical results? That way you can share it with them tonight instead of trying to explain it from memory.",
  },
];

const faqs = [
  {
    q: "Is this just ManyChat with a coaching skin?",
    a: "No. ManyChat is a chat-flow builder. You drag and drop blocks like 'if user types X, send Y.' That works for simple e-commerce flows but not for the messy reality of a coaching DM, where leads jump topics and ask emotionally loaded questions. Clinchd uses a true language model that reads context, weighs your qualification criteria, and writes a response that fits the moment. The two products are not in the same category.",
  },
  {
    q: "What if my coaching offer is sensitive (relationship, mental health, recovery)?",
    a: "Clinchd is designed to handle emotionally charged conversations with care. The AI leads with acknowledgment before qualifying. It does not diagnose, give therapy-style advice, or overstep boundaries. For sensitive coaching niches like relationship, mental health, or recovery, you can configure the AI to flag certain conversation types for immediate human review instead of auto-responding.",
  },
  {
    q: "How does the AI qualify a $5K mastermind prospect differently from a $97 course buyer?",
    a: "During setup you describe your offer, ideal client, and qualification criteria. For a $5K mastermind, the AI asks about revenue level, business model, team size, investment readiness, and what they have already tried. For a $97 course, the qualification is lighter and the AI moves toward purchase faster. You set the depth, the AI matches it.",
  },
  {
    q: "Can the AI handle objections without sounding salesy?",
    a: "Yes. The objection-handling library is built around empathy-first language: acknowledge, reframe, ask a better question. When a lead says 'I cannot afford it,' the AI does not push back with a stock counter. It acknowledges, asks about timing or what would need to be true to make it work, and only reframes if the conversation invites it.",
  },
  {
    q: "What kinds of coaches use Clinchd?",
    a: "Fitness coaches, business coaches, life coaches, relationship coaches, health coaches, mindset coaches, dating coaches, nutrition coaches, career coaches, online course creators, wellness coaches, and financial coaches. Anyone selling a $500+ coaching offer through Instagram DMs.",
  },
  {
    q: "Will it work if I have under 5K followers?",
    a: "Yes. The number of followers matters less than the volume of qualified DM conversations. Coaches with 2K to 4K engaged followers often see better results than coaches with 50K passive followers. If you are getting more than 10 DMs a week from people interested in your offer, Clinchd will pay for itself.",
  },
  {
    q: "Can I take over the conversation manually if I want to?",
    a: "Yes, instantly. Every conversation can be flipped to manual mode with one click. The AI hands off the full conversation history and your context bundle so you can pick up exactly where it left off, no awkward 'as I was saying' moments.",
  },
  {
    q: "How is this different from hiring a setter?",
    a: "A human setter costs $2,000 to $4,000 per month for part-time work, $4,000 to $8,000 for full-time, and only works during business hours. The AI works 24/7 for $97 to $197 per month. The math gets clear fast. Most coaches who switch keep their setter for the first 30 days, run both side by side, and then make the call based on booked-call numbers.",
  },
];

export default function AiDmSetterForCoachesPage() {
  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Clinchd",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.clinchd.io",
    description:
      "Clinchd is the AI DM setter built for coaches. It qualifies high-ticket prospects, handles coaching-specific objections, and books discovery calls 24/7.",
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
            For Coaches
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            AI DM Setter for Coaches: Qualify Leads and Book Calls 24/7
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            Clinchd is the only AI DM setter built exclusively for coaches selling $500 to $25K offers. It qualifies on budget, handles real coaching objections, and books discovery calls inside the conversation. While you sleep, train clients, or run your day.
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

      {/* Pain section */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            The coach-specific DM problem
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              You posted a Reel at 8 PM. By 11 PM it has 180K views. Your DMs are full of people asking about your program, your prices, your availability. You are asleep. Or coaching. Or eating dinner. Or with your family.
            </p>
            <p>
              By 9 AM the next morning when you finally sit down to reply, half of those leads have moved on. The vulnerability that drove them to DM you is gone. The competitor who replied at midnight has already booked a call. The lead who asked {`"how much?"`} got no answer and decided you must be too expensive.
            </p>
            <p>
              Hiring a human setter solves part of the problem and creates new ones. They cost $2,000 to $4,000 per month. They still only work daytime hours. They need training and management. They quit. They take vacation. Their reply quality varies. And on the day your content goes viral, they get overwhelmed and miss the leads that mattered most.
            </p>
            <p>
              An AI DM setter built for coaches solves the same problem without the cost, the hours, or the management. That is the entire point of Clinchd.
            </p>
          </div>
        </div>
      </section>

      {/* Why coach-specific */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            Why {`"AI for coaches"`} is different from generic DM automation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
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

      {/* Objection examples */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 text-center">
            How the AI handles real coaching objections
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-14">
            Three of the conversations that decide whether a coaching lead converts. Generic chatbots fumble all of them.
          </p>
          <div className="space-y-6">
            {objectionExamples.map((ex) => (
              <div
                key={ex.objection}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-3">
                  Lead says
                </p>
                <p className="text-xl font-extrabold text-stone-900 mb-6">
                  {`"${ex.objection}"`}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-stone-50 rounded-2xl p-6">
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
                      Generic chatbot
                    </p>
                    <p className="text-sm text-stone-500 leading-relaxed">
                      {ex.badResponse}
                    </p>
                  </div>
                  <div className="bg-[#fff5f2] rounded-2xl p-6 border border-[#ff7e67]/20">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-2">
                      Clinchd AI
                    </p>
                    <p className="text-sm text-stone-700 leading-relaxed font-medium">
                      {ex.aiResponse}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Niche pivot */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6 text-center">
            Built for every coaching vertical
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-12">
            Each niche has its own playbook inside Clinchd. Same engine, different objection scripts, qualification flows, and tone presets.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              ["fitness-coaches", "Fitness Coaches"],
              ["business-coaches", "Business Coaches"],
              ["life-coaches", "Life Coaches"],
              ["relationship-coaches", "Relationship Coaches"],
              ["health-coaches", "Health Coaches"],
              ["mindset-coaches", "Mindset Coaches"],
              ["dating-coaches", "Dating Coaches"],
              ["nutrition-coaches", "Nutrition Coaches"],
              ["career-coaches", "Career Coaches"],
              ["online-course-creators", "Online Course Creators"],
              ["wellness-coaches", "Wellness Coaches"],
              ["financial-coaches", "Financial Coaches"],
            ].map(([slug, label]) => (
              <Link
                key={slug}
                href={`/for/${slug}`}
                className="inline-flex items-center px-5 py-2.5 rounded-full bg-[#fff5f2] text-[#ff7e67] text-sm font-bold hover:bg-[#ff7e67] hover:text-white transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why we built it */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-4 text-center">
            Why Clinchd exists
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-6 text-center">
            Built around the qualification patterns we kept seeing
          </h2>
          <div className="space-y-4 text-stone-600 leading-relaxed text-center max-w-2xl mx-auto">
            <p>
              We studied 200+ coach DM scripts before writing a line of code. The pattern was the same every time: high-ticket coaches were losing their best leads to slow reply times, generic chatbot responses, and human setters who couldn't be in the inbox at 11 PM when a Reel went viral.
            </p>
            <p>
              Clinchd is the answer to that pattern. Coaching-specific qualification, empathy-first language, and 24/7 coverage at a price that makes sense for solo coaches.
            </p>
            <p className="text-sm text-stone-400 mt-6">
              We're in early access. Your results would be among the first we publish.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6">
            Less than 1/15th of a human setter
          </h2>
          <p className="text-lg text-stone-500 font-medium mb-10 max-w-2xl mx-auto">
            Flat pricing. Unlimited conversations on the upper tier. No surprise charges when your content goes viral.
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
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            AI DM setter for coaches FAQ
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
            headline="Ready to put the AI setter to work?"
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
            <Link href="/ai-dm-setter" className="text-sm font-bold text-[#ff7e67] hover:underline">
              AI DM Setter (general guide) &rarr;
            </Link>
            <Link href="/instagram-dm-automation-for-coaches" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Instagram DM Automation for Coaches &rarr;
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
            <Link href="/compare/vs-inro" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs Inro &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
