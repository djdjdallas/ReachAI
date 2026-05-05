import Link from "next/link";
import CTABanner from "@/components/CTABanner";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Instagram DM Automation for Coaches: The 2026 Guide",
  description:
    "Everything coaches need to know about Instagram DM automation in 2026. What is safe, what gets accounts flagged, ROI math, and the 5-step setup that turns DMs into booked calls.",
  openGraph: {
    title: "Instagram DM Automation for Coaches: The 2026 Guide",
    description:
      "What is safe, what gets accounts flagged, and the 5-step setup that turns Instagram DMs into booked discovery calls.",
    url: "https://www.clinchd.io/instagram-dm-automation-for-coaches",
    siteName: "Clinchd",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Instagram DM Automation for Coaches: The 2026 Guide",
    description:
      "What is safe, what gets accounts flagged, and the 5-step setup that turns Instagram DMs into booked discovery calls.",
  },
  alternates: {
    canonical: "https://www.clinchd.io/instagram-dm-automation-for-coaches",
  },
};

const setupSteps = [
  {
    title: "Connect through the official Instagram API",
    description:
      "Skip any tool that asks for your Instagram password or runs through a browser extension. Both violate Meta's terms of service and put your account at risk. Use a tool that connects through Instagram's official API. Clinchd is built on the official API and is reviewed by Meta as a Business Partner.",
  },
  {
    title: "Document your offer and ICP",
    description:
      "Write down your program details, price points, ideal client, and the qualifying criteria you would want a human setter to use. Include your usual answers to {\"how much?\"}, {\"is this for me?\"}, and {\"can I pay in installments?\"}. This becomes the AI's playbook.",
  },
  {
    title: "Define what triggers an automated response",
    description:
      "Decide which conversations the AI should handle and which should land in your inbox untouched. New inbound DMs, comment-to-DM triggers, and Story replies are typical AI territory. Existing client conversations, sensitive topics, and crisis flags should escalate to you immediately.",
  },
  {
    title: "Connect Calendly or Cal.com",
    description:
      "Link your scheduling tool so the AI can drop your booking link inside the conversation when a lead is qualified. The AI reads buying signals (questions about scheduling, references to wanting to start, asking what the next step is) and times the link drop accordingly.",
  },
  {
    title: "Run a 7-day calibration window",
    description:
      "Watch the first week of conversations carefully. Approve or correct the AI's responses, flag anything that sounds off, and refine your tone preset. Most coaches need 3 to 5 calibration corrections before the AI is dialed in. After that, it runs without you watching.",
  },
];

const faqs = [
  {
    q: "Is Instagram DM automation against Meta's terms of service?",
    a: "Tools that automate DMs through unofficial scraping, browser extensions, or password-based logins violate Meta's terms and risk account suspension. Tools that operate through the official Instagram Messaging API with human-in-the-loop oversight are fully compliant. Clinchd is built on the official API. The short version: API-based plus human-in-the-loop is safe. Scraper-based bots are not.",
  },
  {
    q: "What gets a coaching account flagged?",
    a: "Sending the same exact message to many people in a short window. Hitting a high message-per-hour rate. Using language that triggers spam classifiers (excessive emojis, link spam, all caps urgency). And operating through unofficial automation that bypasses Meta's API. Compliant tools rate-limit responses, vary phrasing automatically, and never send through anything other than the official API.",
  },
  {
    q: "How much faster do automated DMs convert vs manual replies?",
    a: "Internal Clinchd data across 200+ coaches shows that conversations responded to within 5 minutes convert at roughly 3x the rate of conversations that wait 1+ hour. After 24 hours, conversion drops by 80% or more. The single biggest variable in DM-driven sales is response time, and that is what automation actually fixes.",
  },
  {
    q: "Will automation make my DMs feel less personal?",
    a: "Done badly, yes. Done with a real AI DM setter (not a keyword chatbot), no. Modern AI reads the lead's actual message, understands context, and responds with the right tone for the moment. In Clinchd's testing, coaches whose audiences are warned 'AI replies sometimes' still see no measurable drop in trust or conversion. The fast, thoughtful response matters more than the source.",
  },
  {
    q: "Can I keep certain conversations off automation?",
    a: "Yes. Clinchd lets you whitelist existing clients, mark sensitive contacts, and configure trigger words that immediately escalate a conversation to your inbox without an automated reply. You stay in control of which conversations the AI runs and which it does not.",
  },
  {
    q: "How long does setup take?",
    a: "About 30 minutes for the technical setup (connect Instagram, paste your offer details, link Calendly). Then a 5 to 7 day calibration window where you correct any responses that miss your tone. After that the AI runs without supervision.",
  },
];

export default function InstagramDmAutomationForCoachesPage() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Instagram DM Automation for Coaches: The 2026 Guide",
    description:
      "Everything coaches need to know about Instagram DM automation in 2026.",
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
        "https://www.clinchd.io/instagram-dm-automation-for-coaches",
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
            2026 Guide
          </span>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-stone-900 mb-6 leading-[1.1]">
            Instagram DM Automation for Coaches (2026 Guide)
          </h1>
          <p className="text-lg md:text-xl text-stone-500 font-medium max-w-3xl mx-auto leading-relaxed">
            What is safe, what gets accounts flagged, and the 5-step setup that turns Instagram DMs into a calendar full of qualified discovery calls. Written for coaches selling $500 to $25K offers.
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

      {/* Why automate */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            Why coaches automate Instagram DMs in 2026
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Instagram in 2026 is the most powerful conversion channel a coach has. Reels reach further than they did three years ago. The algorithm rewards conversation. DMs carry more weight than comments. And every viral moment generates a wave of high-intent leads who want to talk now.
            </p>
            <p>
              The bottleneck is not traffic. It is response time. Coaches with 5K, 20K, or 100K followers all hit the same wall: they cannot personally answer every DM the moment it arrives, and the cost of waiting is brutal. Internal Clinchd data shows conversion drops roughly 3x when a reply takes more than an hour, and 5 to 10x when it takes more than a day.
            </p>
            <p>
              Automation closes that response-time gap. The question is not whether to automate. The question is what kind of automation actually works for high-ticket coaching, without breaking Meta's rules or making your DMs feel like a robot.
            </p>
          </div>
        </div>
      </section>

      {/* Compliance callout */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#fff5f2] rounded-[2rem] border border-[#ff7e67]/20 p-10 md:p-12">
            <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-3">
              Quick safety note
            </p>
            <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-4">
              The only safe path: official API + human-in-the-loop
            </h2>
            <p className="text-stone-600 leading-relaxed mb-4">
              Any tool that asks for your Instagram password, runs through a browser extension, or claims to {`"send unlimited DMs"`} from a desktop app is operating outside Meta's terms of service. Those tools risk account bans, and Meta has been steadily cracking down. The only sustainable model is automation built on the official Instagram Messaging API with human-in-the-loop oversight (you can take over any conversation, anytime).
            </p>
            <p className="text-stone-600 leading-relaxed">
              Clinchd is built on the official API and includes one-click human takeover by default. That is what makes it safe to use on a real coaching account.{" "}
              <Link
                href="/blog/does-instagram-allow-dm-automation"
                className="font-bold text-[#ff7e67] hover:underline"
              >
                Read the full compliance breakdown &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* AI vs ManyChat */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-8">
            ManyChat vs an AI DM setter
          </h2>
          <div className="space-y-6 text-stone-600 leading-relaxed">
            <p>
              Most coaches' first exposure to DM automation is ManyChat. ManyChat is a chat-flow builder. You drag and drop blocks like {`"if user types X, send Y."`} It is excellent for simple e-commerce flows where every customer asks the same three questions. It is the wrong tool for high-ticket coaching, where every DM is a snowflake and the qualifier is whether the lead can afford a $5K to $25K offer.
            </p>
            <p>
              An AI DM setter does not run on flows. It runs on a language model that reads each message in context, weighs it against your offer and qualification criteria, and writes a response that fits the moment. When a lead says {`"I need to think about it,"`} ManyChat sends whatever you wrote into block 47. An AI DM setter responds the way you would on a call: acknowledge, ask what they are weighing, move forward.
            </p>
            <p>
              The shorthand: ManyChat runs scripts. An AI DM setter runs conversations.{" "}
              <Link
                href="/compare/vs-manychat"
                className="font-bold text-[#ff7e67] hover:underline"
              >
                See full Clinchd vs ManyChat comparison &rarr;
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ROI math */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-12 text-center">
            The ROI math
          </h2>
          <div className="bg-[#fafaf9] rounded-[2rem] p-8 md:p-12 border border-stone-100">
            <p className="text-stone-600 leading-relaxed mb-6">
              For a coach selling a $5,000 program with a 20% discovery-call close rate, every booked call is worth $1,000 in expected revenue. The numbers below assume a $197/mo Unlimited plan.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 border border-stone-100">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
                  Calls/month
                </p>
                <p className="text-3xl font-black text-stone-900">+8</p>
                <p className="text-sm text-stone-500 mt-1">vs manual replies</p>
              </div>
              <div className="bg-white rounded-2xl p-6 border border-stone-100">
                <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">
                  Closes/month
                </p>
                <p className="text-3xl font-black text-stone-900">+1.6</p>
                <p className="text-sm text-stone-500 mt-1">at 20% close rate</p>
              </div>
              <div className="bg-stone-900 rounded-2xl p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-[#ff7e67] mb-2">
                  Net revenue
                </p>
                <p className="text-3xl font-black">+$7,803</p>
                <p className="text-sm text-stone-300 mt-1">$8K rev minus $197 cost</p>
              </div>
            </div>
            <p className="text-sm text-stone-500 mt-8 text-center">
              At higher tickets ($15K to $25K coaching), the math compounds. A single extra closed deal pays for two years of Clinchd.
            </p>
          </div>
        </div>
      </section>

      {/* 5-step setup */}
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-4 text-center">
            5-step setup walkthrough
          </h2>
          <p className="text-center text-stone-500 max-w-2xl mx-auto mb-14">
            What it actually takes to go from {`"I don't automate"`} to {`"my DMs run themselves"`} in under a week.
          </p>
          <div className="space-y-6">
            {setupSteps.map((step, i) => (
              <div
                key={step.title}
                className="bg-white rounded-[2rem] border border-stone-100 p-8 soft-shadow"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#fff5f2] text-[#ff7e67] font-black text-lg">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-stone-900 mb-3">
                      {step.title}
                    </h3>
                    <p className="text-stone-500 text-sm leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black text-stone-900 mb-10 text-center">
            Instagram DM automation FAQ
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
      <section className="py-16 md:py-24 bg-[#fafaf9]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <CTABanner
            headline="Ready to automate your DMs the right way?"
            subheadline="Start your 7-day free trial. Built on the official Instagram API. Set up in under 30 minutes."
            buttonText="Start Free Trial"
            buttonHref="/signup"
            variant="dark"
          />
        </div>
      </section>

      {/* Internal links */}
      <section className="py-12 bg-white border-t border-stone-100">
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
            <Link href="/book-discovery-calls-from-instagram" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Book Discovery Calls From Instagram &rarr;
            </Link>
            <Link href="/compare/vs-manychat" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Clinchd vs ManyChat &rarr;
            </Link>
            <Link href="/blog/does-instagram-allow-dm-automation" className="text-sm font-bold text-[#ff7e67] hover:underline">
              Does Instagram allow DM automation? &rarr;
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
