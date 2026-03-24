import GsapProvider from "@/components/landing/gsap-provider";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import Problem from "@/components/landing/problem";
import TrustedBy from "@/components/landing/trusted-by";
import HowItWorks from "@/components/landing/how-it-works";
import Features from "@/components/landing/features";
import ComparisonCallout from "@/components/landing/comparison-callout";
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
    url: "https://clinchd.io",
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
  url: "https://clinchd.io",
  description:
    "AI-powered Instagram DM automation for coaches and course creators.",
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Clinchd",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://clinchd.io",
  offers: {
    "@type": "Offer",
    price: "97",
    priceCurrency: "USD",
    priceValidUntil: "2027-12-31",
  },
  description:
    "AI appointment setter that qualifies leads, handles objections, and books discovery calls in Instagram DMs.",
};

export default function HomePage() {
  return (
    <div className="landing-theme min-h-screen flex flex-col">
      <JsonLd data={organizationSchema} />
      <JsonLd data={softwareSchema} />
      <Navbar />
      <GsapProvider>
        <main>
          <Hero />
          <TrustedBy />
          <Problem />
          <HowItWorks />
          <Features />
          <ComparisonCallout />
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
