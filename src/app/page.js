import GsapProvider from "@/components/landing/gsap-provider";
import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import TrustedBy from "@/components/landing/trusted-by";
import HowItWorks from "@/components/landing/how-it-works";
import Features from "@/components/landing/features";
import Testimonials from "@/components/landing/testimonials";
import Pricing from "@/components/landing/pricing";
import Faq from "@/components/landing/faq";
import FinalCta from "@/components/landing/final-cta";
import Footer from "@/components/landing/footer";

export default function HomePage() {
  return (
    <div className="landing-theme min-h-screen flex flex-col">
      <Navbar />
      <GsapProvider>
        <main>
          <Hero />
          <TrustedBy />
          <HowItWorks />
          <Features />
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
