import GsapProvider from "@/components/landing/gsap-provider";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import Problem from "@/components/landing/problem";
import WhoItsFor from "@/components/landing/who-its-for";
import TrustedBy from "@/components/landing/trusted-by";
import HowItWorks from "@/components/landing/how-it-works";
import Features from "@/components/landing/features";
import ObjectionHandling from "@/components/landing/objection-handling";
import ComparisonCallout from "@/components/landing/comparison-callout";
import Integrations from "@/components/landing/integrations";
import Testimonials from "@/components/landing/testimonials";
import Pricing from "@/components/landing/pricing";
import Faq from "@/components/landing/faq";
import FinalCta from "@/components/landing/final-cta";
import Footer from "@/components/landing/footer";
import JsonLd from "@/components/JsonLd";
import RecoveryRedirect from "@/components/RecoveryRedirect";

export const metadata = {
  title: "Clinchd: AI-Assisted Instagram DMs for Coaches",
  description:
    "Clinchd is a shared Instagram inbox with AI-assisted replies that qualify leads and book discovery calls, with the account owner in full control of every conversation.",
  keywords: [
    "instagram dm ai assistant for coaches",
    "ai appointment setter instagram",
    "manychat alternative for coaches 2026",
    "instagram dm ai for coaches",
    "ai setter for instagram coaches",
  ],
  openGraph: {
    title: "Clinchd: AI-Assisted Instagram DMs for Coaches",
    description:
      "A shared Instagram inbox with AI-assisted replies that qualify leads and book discovery calls. You stay in control.",
    url: "https://www.clinchd.io",
    siteName: "Clinchd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinchd: AI-Assisted Instagram DMs for Coaches",
    description:
      "A shared Instagram inbox with AI-assisted replies that qualify leads and book discovery calls.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Clinchd",
  url: "https://www.clinchd.io",
  description:
    "AI-assisted Instagram DM conversations for coaches and course creators. A shared inbox where the owner controls every reply.",
  foundingDate: "2026",
  sameAs: [],
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Clinchd",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Instagram DM Assistant",
  operatingSystem: "Web",
  url: "https://www.clinchd.io",
  offers: [
    {
      "@type": "Offer",
      name: "Base",
      price: "97",
      priceCurrency: "USD",
      priceValidUntil: "2027-12-31",
      description: "1,500 qualified conversations/month, AI setter, lead qualification, call booking, email support.",
    },
    {
      "@type": "Offer",
      name: "Unlimited",
      price: "197",
      priceCurrency: "USD",
      priceValidUntil: "2027-12-31",
      description: "Unlimited conversations/month, voice replies in your own recorded audio, advanced analytics, priority support, custom AI personality tuning.",
    },
  ],
  description:
    "AI appointment setter that qualifies leads, handles objections, and books discovery calls in Instagram DMs. Built specifically for coaches and course creators selling high-ticket offers.",
  featureList:
    "AI-powered DM conversations, Comment-to-DM workflows, Story reply workflows, Lead qualification, Objection handling, Discovery call booking, Analytics dashboard, Human takeover, Flat monthly pricing, Meta Graph API compliance",
};

const faqPageSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is Clinchd compliant with Instagram's API?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Clinchd uses the official Meta Graph API and only responds to inbound messages. We never send unsolicited spam or cold outreach. We follow all of Instagram's platform policies.",
      },
    },
    {
      "@type": "Question",
      name: "Will my followers know it's AI?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Clinchd matches your coaching voice with human-like cadence, and the AI is honest: if a lead directly asks whether they're talking to an AI, the assistant confirms and offers to hand off to you. You stay in control of every conversation and can jump in at any time.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to be doing $50k a month?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. Clinchd is built for coaches earning well below that. If you have more DMs than hours, you're the fit. There's no application and no minimum to clear.",
      },
    },
    {
      "@type": "Question",
      name: "Is this just a chatbot with a script?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. It reads what each person actually says, figures out intent, and responds in your tone. If someone gets hostile or asks for a refund, it steps back instead of barreling ahead.",
      },
    },
    {
      "@type": "Question",
      name: "Do you fake my voice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Never a synthetic clone of you. On the Unlimited plan you can record your own audio snippets and Clinchd uses your real voice on the replies that fit. What you record is what they hear.",
      },
    },
    {
      "@type": "Question",
      name: "What does it cost? Really.",
      acceptedAnswer: {
        "@type": "Answer",
        text: "$97/month for up to 1,500 qualified conversations. $197/month for unlimited plus voice replies. The price is on this page because you shouldn't have to book a call to learn it.",
      },
    },
    {
      "@type": "Question",
      name: "What if someone asks something the AI isn't trained on?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Clinchd gracefully handles unknown topics by steering the conversation back to qualification, or it flags the lead for human takeover. You can jump into any conversation with one click and pick up exactly where the AI left off.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need a business Instagram account?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, you'll need an Instagram Business or Creator account connected to a Facebook Page. This is required by Meta's API. If you're currently on a personal account, switching takes about 2 minutes in your Instagram settings.",
      },
    },
    {
      "@type": "Question",
      name: "How long does setup take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Most coaches are fully set up in under 30 minutes. Connect your Instagram, describe your offer and ideal client, review the AI's conversation script, and flip the switch. No flow builders, no coding.",
      },
    },
    {
      "@type": "Question",
      name: "Can I cancel anytime?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely. No contracts, no commitments. Cancel with one click from your dashboard. You'll keep access through the end of your billing period. We also offer a 7-day free trial so you can test everything risk-free.",
      },
    },
    {
      "@type": "Question",
      name: "What if I have a VA already, can they use this too?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Your VA can access the Clinchd dashboard to monitor conversations, take over chats, and review lead quality. Many coaches use Clinchd as their AI first responder and have their VA handle warm handoffs for complex conversations.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <div className="landing-theme min-h-screen flex flex-col">
      <RecoveryRedirect />
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqPageSchema} />
      <Navbar />
      <GsapProvider>
        <main>
          <Hero />
          <TrustedBy />
          <Problem />
          <WhoItsFor />
          <HowItWorks />
          <Features />
          <ObjectionHandling />
          <ComparisonCallout />
          <Integrations />
          <Testimonials />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
      </GsapProvider>
      <Footer />
    </div>
  );
}
