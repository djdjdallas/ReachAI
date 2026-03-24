import {
  MessageCircle,
  UserCheck,
  ShieldAlert,
  CalendarPlus,
  LayoutDashboard,
  PenTool,
} from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "AI Replies",
    description:
      "Responds instantly in your unique brand voice, 24/7 with deep semantic understanding.",
    bgClass: "bg-[#fff5f2]",
  },
  {
    icon: UserCheck,
    title: "Qualification",
    description:
      "Filters out time-wasters so you only talk to real buyers ready to pull the trigger.",
    bgClass: "bg-orange-50",
  },
  {
    icon: ShieldAlert,
    title: "Objections",
    description:
      "Trained on your script to squash doubts on the spot using proven sales psychology.",
    bgClass: "bg-rose-50",
  },
  {
    icon: CalendarPlus,
    title: "Auto-Book",
    description:
      "Drops booking links at the peak of buyer interest, syncing directly with Calendly.",
    bgClass: "bg-amber-50",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description:
      "Watch every thread in real time and take over manually with a single click.",
    bgClass: "bg-stone-50",
  },
  {
    icon: PenTool,
    title: "Script Builder",
    description:
      "AI helps generate your personality from scratch using successful outreach templates.",
    bgClass: "bg-blue-50",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-20 reveal-up">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-stone-900">
            Built for Closers Who Don&apos;t Have Time to Type
          </h2>
          <p className="text-stone-500 text-lg font-medium">
            Powerful tools for serious sales automation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-100 border border-stone-100 rounded-[2rem] overflow-hidden">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="p-12 bg-white group hover:bg-[#fff5f2] transition-colors reveal-up"
              >
                <div
                  className={`w-14 h-14 rounded-2xl ${feature.bgClass} flex items-center justify-center mb-8`}
                >
                  <Icon className="w-7 h-7 text-[#ff7e67]" />
                </div>
                <h4 className="font-extrabold text-xl mb-4 text-stone-900">
                  {feature.title}
                </h4>
                <p className="text-sm text-stone-500 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
