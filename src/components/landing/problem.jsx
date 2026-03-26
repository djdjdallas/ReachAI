import { Clock, Bot, MoonStar } from "lucide-react";

const painPoints = [
  {
    icon: Clock,
    title: "2+ hours a day in DMs",
    description:
      "You're manually qualifying leads that never convert — and the ones that would have converted slipped through while you were coaching a client.",
  },
  {
    icon: Bot,
    title: "ManyChat feels robotic",
    description:
      "You tried flow-based automation but the rigid decision trees feel impersonal, take hours to set up, and still miss the nuance of a real conversation.",
  },
  {
    icon: MoonStar,
    title: "Leads go cold overnight",
    description:
      "Every weekend, every vacation, every time you step away from your phone — hot leads message you and get nothing back until it's too late.",
  },
];

export default function Problem() {
  return (
    <section className="py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 reveal-up">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-stone-900 mb-6">
            Your DMs are leaking revenue
          </h2>
          <p className="text-stone-500 text-lg font-medium">
            Most coaches lose 30-50% of their warm leads because they can&apos;t
            respond fast enough. Sound familiar?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {painPoints.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.title}
                className="bg-stone-50 border border-stone-100 rounded-[2rem] p-10 reveal-up"
              >
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-xl font-extrabold text-stone-900 mb-3">
                  {point.title}
                </h3>
                <p className="text-sm text-stone-500 leading-relaxed font-medium">
                  {point.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* 24/7 Availability Video */}
        <div className="mt-16 reveal-up">
          <div className="bg-stone-50 border border-stone-100 rounded-[2rem] p-3 md:p-4 overflow-hidden">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full rounded-[1.5rem]"
            >
              <source
                src="/animations/02-availability-24x7.mp4"
                type="video/mp4"
              />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
