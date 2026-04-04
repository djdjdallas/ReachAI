import Link from "next/link";
import { notFound } from "next/navigation";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

const NICHE_DATA = {
  "fitness-coaches": {
    title: "AI Instagram DM Automation for Fitness Coaches (2026)",
    description:
      "Automate your Instagram DMs as a fitness coach. Clinchd qualifies leads, handles objections, and books discovery calls 24/7 so you never lose a client to a slow reply.",
    nicheLabel: "Fitness Coaches",
    heroHeadline: "Your Reels Go Viral at 11 PM. Who Is Answering Those DMs?",
    heroSub:
      "Clinchd is the AI DM setter built for fitness coaches. It qualifies leads, handles pricing objections, and books discovery calls while you sleep, train, or coach.",
    painHeadline: "The Fitness Coach DM Problem",
    painParagraphs: [
      "You posted a transformation Reel at 8 PM. By midnight it has 200K views and your DMs are flooded with people asking about your program. You are asleep. By 9 AM when you finally open your inbox, half those leads have already found another trainer who responded faster.",
      "Fitness coaching is uniquely time-sensitive. Your audience is emotionally motivated in the moment they see a result, a workout, or a transformation. That motivation fades fast. A lead who DMs you at 11 PM after watching your client's before-and-after is not going to feel the same urgency at 10 AM tomorrow.",
      "Hiring a human setter costs $2,000-$4,000/month, and they still only work during business hours. You need something that handles every DM, every hour, with the same quality you would bring to the conversation yourself.",
    ],
    features: [
      {
        title: "AI Qualification for Fitness Leads",
        description:
          "The AI asks about their current fitness level, goals, timeline, and budget before you ever get on a call. No more wasting 30-minute consultations on people who want a free workout plan.",
      },
      {
        title: "Objection Handling for Training Programs",
        description:
          "When leads say they cannot afford your $500-$2K program or need to think about it, the AI responds with empathy and value framing specific to fitness coaching. It handles pricing hesitation, partner approval, and past bad experiences with trainers.",
      },
      {
        title: "Auto-Booking via Calendly or Cal.com",
        description:
          "Once a lead is qualified, the AI drops your booking link at the right moment in the conversation. No awkward transitions, no premature pitches. The lead feels ready, and the call gets booked.",
      },
    ],
    testimonial: {
      quote:
        "I was paying $2,800/month for a human setter who worked 9-5 EST. Clinchd replaced that entirely. It handles my DMs around the clock, qualifies people on budget and commitment level, and books calls while I am training clients. Last month I had 27 discovery calls booked. My setter was averaging 14.",
      name: "Jasmine Torres",
      detail: "Online Personal Trainer, 14K followers",
    },
    faqs: [
      {
        q: "Will it work for my online personal training program?",
        a: "Yes. Clinchd is designed for coaches selling programs priced at $500 and above. You describe your training program, ideal client, and qualification criteria during setup. The AI uses that to have natural conversations that qualify leads and book calls for your specific offer.",
      },
      {
        q: "What if leads ask about my workout programs?",
        a: "The AI is trained on your program details during setup. It can explain your methodology, coaching structure, and what results clients typically see without giving away your entire program. It frames your offer in a way that builds curiosity and drives toward a discovery call.",
      },
      {
        q: "How does it handle price objections for $500-$2K programs?",
        a: "The AI uses proven objection-handling frameworks tailored to fitness coaching. When a lead says your program is too expensive, it reframes the investment in terms of results, time saved, and the cost of staying stuck. It knows when to address the objection and when to redirect to a call where you can handle it personally.",
      },
      {
        q: "Can it tell the difference between someone who wants a free tip and a real buyer?",
        a: "That is exactly what the qualification flow does. The AI asks about goals, timeline, budget range, and past experience with coaching. A lead looking for free advice gets filtered out naturally. A serious buyer gets moved toward a booking. You only spend time on calls with qualified prospects.",
      },
    ],
  },

  "business-coaches": {
    title: "AI Instagram DM Automation for Business Coaches (2026)",
    description:
      "Automate your Instagram DMs as a business coach. Clinchd qualifies high-ticket prospects, handles objections, and books discovery calls for your $5K-$25K programs.",
    nicheLabel: "Business Coaches",
    heroHeadline: "Your $15K Prospects Expect a Fast, Professional Response",
    heroSub:
      "Clinchd is the AI DM setter built for business coaches. It qualifies high-ticket prospects, handles ROI objections, and books discovery calls around the clock.",
    painHeadline: "The Business Coach DM Problem",
    painParagraphs: [
      "You are selling a $5K-$25K program. The prospects who DM you are business owners, founders, and executives. They are evaluating you from the first message. A slow reply does not just lose the sale, it signals that you are not operating at the level you are coaching others to reach.",
      "High-ticket business coaching has a narrow conversion window. A prospect who DMs you after watching your content about scaling revenue is in decision mode right now. If you reply six hours later, they have already moved on to the next coach, or worse, talked themselves out of investing entirely.",
      "Your DMs are not a casual inbox. They are your highest-converting sales channel. Every hour a qualified prospect sits unread is revenue left on the table.",
    ],
    features: [
      {
        title: "AI Qualification for High-Ticket Prospects",
        description:
          "The AI qualifies prospects on revenue level, business stage, investment readiness, and specific goals. It filters out people who are not a fit for a $5K+ program and fast-tracks serious buyers to your calendar.",
      },
      {
        title: "Objection Handling for Premium Programs",
        description:
          "When a prospect asks about ROI guarantees or says they need to discuss with a business partner, the AI handles it with the professionalism your price point demands. It addresses investment hesitation, timing concerns, and comparison shopping with confidence.",
      },
      {
        title: "Auto-Booking via Calendly or Cal.com",
        description:
          "The AI sends your booking link when the prospect is ready, not a moment too soon. It reads the conversation for buying signals and presents the call as the logical next step, keeping your close rate high.",
      },
    ],
    testimonial: {
      quote:
        "I went from 3 booked discovery calls per week to 11 in my first month with Clinchd. The AI qualifies on revenue, business model, and investment readiness before anyone hits my calendar. Every call I take now is with someone who is genuinely ready to invest in a $12K mastermind. My close rate went from 25% to 48%.",
      name: "David Chen",
      detail: "Business Coach, 22K followers",
    },
    faqs: [
      {
        q: "Can it handle questions about my $15K mastermind?",
        a: "Yes. During setup you provide details about your program, pricing tiers, and what is included. The AI explains your offer with the right level of detail to build interest without giving away your entire framework. It positions the discovery call as the place to go deeper.",
      },
      {
        q: "How does it qualify for high-ticket readiness?",
        a: "The AI asks about current revenue, business model, team size, and investment timeline. You define what a qualified lead looks like during setup, and the AI filters accordingly. Leads who do not meet your criteria get a polite response. Qualified leads get fast-tracked to your calendar.",
      },
      {
        q: "What if prospects ask about ROI guarantees?",
        a: "The AI is trained to handle ROI conversations without making claims you cannot back up. It reframes the discussion around client results, your methodology, and what makes your program different. It acknowledges the question honestly and moves toward a call where you can address specifics.",
      },
      {
        q: "Will the AI sound professional enough for executive-level prospects?",
        a: "The AI matches the tone and professionalism of your brand. During setup you provide example messages and your communication style. The AI adapts its language to fit your audience, whether that is startup founders, agency owners, or corporate executives exploring coaching.",
      },
    ],
  },

  "life-coaches": {
    title: "AI Instagram DM Automation for Life Coaches (2026)",
    description:
      "Automate your Instagram DMs as a life coach. Clinchd responds with warmth and empathy, qualifies leads, and books discovery calls for your transformation programs.",
    nicheLabel: "Life Coaches",
    heroHeadline: "Your Leads DM After a Vulnerable Post. They Need a Warm Response Now.",
    heroSub:
      "Clinchd is the AI DM setter built for life coaches. It responds with empathy, qualifies leads gently, and books discovery calls for your transformation programs.",
    painHeadline: "The Life Coach DM Problem",
    painParagraphs: [
      "Life coaching leads are different. They do not DM you because they saw a case study about revenue growth. They DM you because something you said made them feel seen. Maybe it was a post about overcoming self-doubt, a Story about boundaries, or a Reel about finding purpose after burnout. They are reaching out from an emotional place, and they need to feel met with warmth immediately.",
      "A generic chatbot response kills that moment. A delayed reply loses it entirely. By the time you respond the next morning, the vulnerability that drove them to reach out has been replaced by doubt, embarrassment, or distraction. The window is gone.",
      "Life coaches need an AI that can hold space in a DM conversation, that responds with empathy before it qualifies, and that moves toward a discovery call without feeling transactional. That is exactly what Clinchd was built to do.",
    ],
    features: [
      {
        title: "AI Qualification with Empathy",
        description:
          "The AI opens with warmth and acknowledgment before asking any qualifying questions. It mirrors the emotional tone of the lead's message and gently explores their goals, readiness for change, and what they are looking for in a coaching relationship.",
      },
      {
        title: "Objection Handling for Transformation Programs",
        description:
          "When leads say they are not sure if coaching is right for them or worry about the investment, the AI responds with understanding. It addresses fear of commitment, past disappointments, and uncertainty about change with language that feels human and supportive.",
      },
      {
        title: "Auto-Booking via Calendly or Cal.com",
        description:
          "The AI introduces the discovery call as a safe, pressure-free conversation. It frames the booking as an opportunity for the lead to explore whether the program feels right, not a sales pitch. The result is higher show-up rates and warmer conversations.",
      },
    ],
    testimonial: {
      quote:
        "I was terrified that an AI would sound cold or robotic in my DMs. My audience is people going through real stuff, career transitions, relationship endings, burnout. Clinchd surprised me completely. The AI sounds warm, asks thoughtful questions, and moves people toward a call without ever feeling pushy. I went from 2 calls a week to 14 in my first month.",
      name: "Anika Patel",
      detail: "Life Coach, 9K followers",
    },
    faqs: [
      {
        q: "Will the AI sound warm and empathetic?",
        a: "Yes. During setup you provide your communication style, example messages, and the emotional tone you want in conversations. Clinchd adapts its language to match. The AI leads with acknowledgment and empathy before qualifying, which is critical for life coaching leads who reach out from vulnerable places.",
      },
      {
        q: "Can it handle sensitive conversations?",
        a: "The AI is designed to respond thoughtfully to emotionally charged messages. It does not diagnose, give therapy-style advice, or overstep boundaries. It acknowledges what the lead shares, validates their feelings, and gently explores whether your coaching program could help. Conversations that need a human touch are flagged for immediate handoff.",
      },
      {
        q: "How does it qualify leads for my 90-day transformation program?",
        a: "The AI asks about where the lead is now, where they want to be, what they have already tried, and their readiness to invest in change. You define your qualification criteria during setup. Leads who match get moved toward a discovery call. Those who are not ready yet receive a warm, supportive response that keeps the door open.",
      },
      {
        q: "What if someone DMs in crisis?",
        a: "Clinchd includes safeguards for sensitive situations. If a message indicates a mental health crisis, the AI responds with care and provides a gentle redirect. It does not attempt to coach or qualify. These conversations are immediately flagged for your personal review so you can respond directly or point them to appropriate resources.",
      },
    ],
  },
};

const VALID_NICHES = Object.keys(NICHE_DATA);

export function generateStaticParams() {
  return VALID_NICHES.map((niche) => ({ niche }));
}

export async function generateMetadata({ params }) {
  const { niche } = await params;
  const data = NICHE_DATA[niche];
  if (!data) return {};

  return {
    title: data.title,
    description: data.description,
    openGraph: {
      title: data.title,
      description: data.description,
      url: `https://www.clinchd.io/for/${niche}`,
      siteName: "Clinchd",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
    },
  };
}

export default async function NichePage({ params }) {
  const { niche } = await params;
  const data = NICHE_DATA[niche];
  if (!data) notFound();

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Clinchd",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: "https://www.clinchd.io",
    description: data.description,
    offers: [
      {
        "@type": "Offer",
        price: "97",
        priceCurrency: "USD",
        name: "Base Plan",
        description: "500 DM conversations per month",
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
    mainEntity: data.faqs.map((faq) => ({
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
            {data.nicheLabel}
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            {data.heroHeadline}
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            {data.heroSub}
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

      {/* Pain section */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            {data.painHeadline}
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            {data.painParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            How Clinchd works for {data.nicheLabel.toLowerCase()}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.features.map((feature) => (
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

      {/* Testimonial */}
      <section className="py-16 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <blockquote className="text-xl md:text-2xl font-medium text-stone-700 italic leading-relaxed mb-8">
            &ldquo;{data.testimonial.quote}&rdquo;
          </blockquote>
          <p className="font-extrabold text-stone-900">{data.testimonial.name}</p>
          <p className="text-sm text-stone-400 font-bold">{data.testimonial.detail}</p>
        </div>
      </section>

      {/* Pricing reference */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6">
            Simple, flat pricing
          </h2>
          <p className="text-lg text-stone-500 font-medium mb-10 max-w-2xl mx-auto">
            No per-message fees. No contact limits that spike your bill when a Reel goes viral.
            Just flat monthly pricing that stays the same whether you get 50 DMs or 5,000.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow">
              <p className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-2">Base</p>
              <p className="text-4xl font-black text-stone-900 mb-2">$97<span className="text-lg font-bold text-stone-400">/mo</span></p>
              <p className="text-sm text-stone-500">500 DM conversations/month</p>
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
            FAQ for {data.nicheLabel.toLowerCase()}
          </h2>
          <div className="space-y-6">
            {data.faqs.map((faq) => (
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
            headline={`Ready to automate your DMs as a ${data.nicheLabel.toLowerCase().replace("coaches", "coach")}?`}
            subheadline="Start your 7-day free trial — no credit card required. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>
    </>
  );
}
