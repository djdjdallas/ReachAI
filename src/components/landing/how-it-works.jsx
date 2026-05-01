import ConnectSetup from "@/components/landing/animations/ConnectSetup";
import QualifyDM from "@/components/landing/animations/QualifyDM";
import BookingConfirmed from "@/components/landing/animations/BookingConfirmed";

const steps = [
  {
    number: "01",
    title: "Connect & Describe Your Offer",
    description:
      "Link your Instagram account in one click, then tell Clinchd about your coaching offer, ideal client, and how you handle objections. Takes 5 minutes.",
    Component: ConnectSetup,
    video: "/animations/04-smart-replies.mp4",
  },
  {
    number: "02",
    title: "AI Qualifies Every DM",
    description:
      "Every new message gets read, qualified, and replied to in your voice. Clinchd asks the right questions, handles objections, and filters tire-kickers from real buyers.",
    Component: QualifyDM,
    video: "/animations/03-lead-qualification.mp4",
  },
  {
    number: "03",
    title: "Discovery Calls Get Booked",
    description:
      "When a lead is qualified and interested, Clinchd drops your Calendly link at exactly the right moment. You show up to pre-qualified calls ready to close.",
    Component: BookingConfirmed,
    video: "/animations/05-calendar-booking.mp4",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 md:py-48 bg-[#fafaf9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-24 reveal-up">
          <div className="inline-flex items-center px-4 py-1 rounded-full bg-stone-100 text-stone-500 text-[11px] font-bold uppercase tracking-widest mb-6">
            How It Works
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight text-stone-900">
            From DM to discovery call in under 10 minutes.
          </h2>
          <p className="text-stone-500 text-xl font-medium">
            A 3-step workflow that replaces your setter and saves you 20+ hours a
            week.
          </p>
        </div>

        <div className="space-y-20 md:space-y-32">
          {steps.map((step, i) => {
            const isReversed = i % 2 !== 0;
            const StepComponent = step.Component;
            return (
              <div
                key={step.number}
                className={`flex flex-col ${
                  isReversed ? "md:flex-row-reverse" : "md:flex-row"
                } items-center gap-12 md:gap-16 reveal-up`}
              >
                {/* Text */}
                <div className="flex-1 md:max-w-md">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#ff7e67] text-white text-lg font-black mb-6 shadow-lg shadow-[#ff7e67]/20">
                    {step.number}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-stone-900 mb-4">
                    {step.title}
                  </h3>
                  <p className="text-stone-500 text-base md:text-lg leading-relaxed font-medium">
                    {step.description}
                  </p>
                </div>

                {/* Animation */}
                <div className="flex-1 w-full">
                  <div className="aspect-[5/4] w-full">
                    {StepComponent ? (
                      <StepComponent />
                    ) : (
                      <div className="bg-white border border-stone-100 rounded-[2rem] p-3 md:p-4 soft-shadow overflow-hidden">
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full rounded-[1.5rem]"
                        >
                          <source src={step.video} type="video/mp4" />
                        </video>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
