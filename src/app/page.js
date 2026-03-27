import GsapProvider from "@/components/landing/gsap-provider";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import Problem from "@/components/landing/problem";
import TrustedBy from "@/components/landing/trusted-by";
import HowItWorks from "@/components/landing/how-it-works";
import Features from "@/components/landing/features";
import ComparisonCallout from "@/components/landing/comparison-callout";
import Integrations from "@/components/landing/integrations";
import Testimonials from "@/components/landing/testimonials";
import Pricing from "@/components/landing/pricing";
import Faq from "@/components/landing/faq";
import FinalCta from "@/components/landing/final-cta";
import Footer from "@/components/landing/footer";
import JsonLd from "@/components/JsonLd";

export const metadata = {
  title: "Clinchd — AI Instagram DM Automation for Coaches",
  description:
    "Clinchd qualifies your Instagram DM leads and books discovery calls automatically. Replace your setter for $97/month. No flows, no complexity — just AI that sells.",
  keywords: [
    "instagram dm automation for coaches",
    "ai appointment setter instagram",
    "manychat alternative for coaches 2026",
    "instagram dm bot for coaches",
    "automate instagram dms coaching business",
  ],
  openGraph: {
    title: "Clinchd — AI Instagram DM Automation for Coaches",
    description:
      "Clinchd qualifies your Instagram DM leads and books discovery calls automatically. Replace your setter for $97/month.",
    url: "https://www.clinchd.io",
    siteName: "Clinchd",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinchd — AI Instagram DM Automation for Coaches",
    description:
      "Clinchd qualifies your Instagram DM leads and books discovery calls automatically. Replace your setter for $97/month.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Clinchd",
  url: "https://www.clinchd.io",
  description:
    "AI-powered Instagram DM automation for coaches and course creators.",
  foundingDate: "2026",
  sameAs: [],
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Clinchd",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Instagram DM Automation",
  operatingSystem: "Web",
  url: "https://www.clinchd.io",
  offers: [
    {
      "@type": "Offer",
      name: "Base",
      price: "97",
      priceCurrency: "USD",
      priceValidUntil: "2027-12-31",
      description: "500 DMs/month, AI setter, lead qualification, auto-booking, email support.",
    },
    {
      "@type": "Offer",
      name: "Unlimited",
      price: "197",
      priceCurrency: "USD",
      priceValidUntil: "2027-12-31",
      description: "Unlimited DMs/month, advanced analytics, priority support, custom AI personality tuning.",
    },
  ],
  description:
    "AI appointment setter that qualifies leads, handles objections, and books discovery calls in Instagram DMs. Built specifically for coaches and course creators selling high-ticket offers.",
  featureList:
    "AI-powered DM conversations, Comment-to-DM automation, Story reply automation, Lead qualification, Objection handling, Discovery call booking, Analytics dashboard, Human takeover, Flat monthly pricing, Meta Graph API compliance",
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
        text: "In our testing, over 95% of leads don't realize they're talking to AI. You provide your tone and sales script. Clinchd matches your specific coaching voice with human-like delays so conversations feel natural.",
      },
    },
    {
      "@type": "Question",
      name: "How is Clinchd different from ManyChat?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "ManyChat uses rigid decision-tree flows and charges per contact. Clinchd is an AI-native setter that understands context, handles objections dynamically, and qualifies leads like a real sales rep for a flat $97/mo. No flows to build, no per-contact fees.",
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
      name: "What if I have a VA already — can they use this too?",
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
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareSchema} />
      <JsonLd data={faqPageSchema} />
      <Navbar />
      <GsapProvider>
        <main>
          <Hero />
          <TrustedBy />
          <Problem />
          <HowItWorks />
          <Features />
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
