import {
  MessageCircle,
  UserCheck,
  ShieldAlert,
  CalendarPlus,
  LayoutDashboard,
  PenTool,
  Sparkles,
  Mic,
} from "lucide-react";
import AgentStats from "@/components/landing/animations/AgentStats";
import ComingSoonBadge from "@/components/landing/coming-soon-badge";

const baseFeatures = [
  {
    icon: MessageCircle,
    title: "AI Setter Replies",
    description:
      "Responds to every DM in your voice, 24/7, qualifying leads while you coach, sleep, or live your life.",
    bgClass: "bg-[#fff5f2]",
  },
  {
    icon: UserCheck,
    title: "Lead Qualification",
    description:
      "Asks the right questions to filter tire-kickers from high-ticket buyers ready to book a discovery call.",
    bgClass: "bg-orange-50",
  },
  {
    icon: ShieldAlert,
    title: "Objection Handling",
    description:
      "Trained on your exact sales script. Handles \"I can't afford it,\" \"I need to think,\" \"I need to ask my partner,\" and \"what if it doesn't work for me\" the way you would on a discovery call.",
    bgClass: "bg-rose-50",
  },
  {
    icon: CalendarPlus,
    title: "Auto-Book Calls",
    description:
      "Drops your Calendly or Cal.com link at the perfect moment, when buyer interest peaks, not a second too early.",
    bgClass: "bg-amber-50",
  },
  {
    icon: LayoutDashboard,
    title: "Live Dashboard",
    description:
      "Watch every conversation in real time. See who's qualifying, who booked, and jump in manually with one click.",
    bgClass: "bg-stone-50",
  },
  {
    icon: PenTool,
    title: "Script Builder",
    description:
      "AI generates your coaching-specific conversation flow from scratch. Tweak the tone until it sounds like you.",
    bgClass: "bg-blue-50",
  },
];

const commentToDmCard = {
  icon: Sparkles,
  title: "High-Intent Comment Routing",
  description:
    "AI grades every comment on your Reels for buyer intent. Only the high-intent ones get a personalized DM. The noise stays in the comments; the leads land in your inbox.",
  bgClass: "bg-[#fff5f2]",
};

const voiceRepliesComingSoon = {
  icon: Mic,
  title: "Voice Replies",
  description:
    "Reply with your own voice instead of text. Record short memos once and Clinchd sends the right one based on what your lead actually says.",
  bgClass: "bg-orange-50",
  comingSoon: true,
  subTag: "Unlimited plan",
};

const features = [
  ...baseFeatures,
  commentToDmCard,
  voiceRepliesComingSoon,
];

export default function Features() {
  return (
    <section id="features" className="py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-20 reveal-up">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-stone-900">
            Your AI Setter That Never Misses a Lead
          </h2>
          <p className="text-stone-500 text-lg font-medium">
            Everything a $5K/mo setter does, at a fraction of the cost.
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
                <div className="flex items-start justify-between gap-3 mb-8">
                  <div
                    className={`w-14 h-14 rounded-2xl ${feature.bgClass} flex items-center justify-center shrink-0`}
                  >
                    <Icon className="w-7 h-7 text-[#ff7e67]" />
                  </div>
                  {feature.comingSoon && (
                    <div className="flex flex-col items-end gap-1">
                      <ComingSoonBadge />
                      {feature.subTag && (
                        <span className="text-xs text-[#a8a29e] font-medium">
                          {feature.subTag}
                        </span>
                      )}
                    </div>
                  )}
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

        {/* Analytics Dashboard Animation */}
        <div className="mt-16 reveal-up">
          <div className="aspect-[5/4] w-full max-w-3xl mx-auto">
            <AgentStats />
          </div>
          <p className="text-center text-sm text-stone-400 font-medium mt-4">
            Track every conversation, qualification, and booking from one dashboard.
          </p>
        </div>
      </div>
    </section>
  );
}
