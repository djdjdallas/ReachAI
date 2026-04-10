"use client";

import {
  Zap,
  Check,
  Monitor,
  UserCheck,
  CalendarCheck,
  ArrowRight,
  Eye,
  PauseCircle,
  Loader2,
} from "lucide-react";

export default function Step5GoLive({
  profile,
  aiActive,
  activating,
  scriptReady,
  instagramConnected,
  onGoLive,
  onGoToDashboard,
  onBack,
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Progress Header (inline for Step 5 as it has its own style) */}
      <header className="w-full max-w-7xl mx-auto px-6 py-8 flex flex-col items-center justify-center">
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 bg-[#ff7e67] rounded-lg flex items-center justify-center shadow-lg shadow-[#ff7e67]/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-extrabold tracking-tight">
            Clinchd
          </span>
        </div>

        <div className="w-full max-w-3xl">
          <div className="flex justify-between items-center relative mb-4">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-stone-200 -z-10 -translate-y-1/2" />
            <div className="absolute top-1/2 left-0 w-full h-1 bg-[#ff7e67] -z-10 -translate-y-1/2 origin-left scale-x-100" />

            {["Instagram", "Script", "Voice", "Preview"].map((label) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-[#ff7e67] text-white rounded-full flex items-center justify-center text-xl shadow-lg border-4 border-[#fafaf9]">
                  <Check className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">
                  {label}
                </span>
              </div>
            ))}

            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-white border-4 border-[#ff7e67] text-[#ff7e67] rounded-full flex items-center justify-center text-lg font-black shadow-lg shadow-[#ff7e67]/10 relative">
                <div className="absolute inset-0 rounded-full animate-ping bg-[#ff7e67]/20" />
                <span className="relative z-10">5</span>
              </div>
              <span className="text-[10px] font-bold text-[#ff7e67] uppercase tracking-widest">
                Go Live
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pb-20">
        {/* Hero Section */}
        <section className="text-center space-y-6 mb-20 pt-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 text-[#ff7e67] rounded-full text-xs font-black uppercase tracking-widest mb-4">
            Step 5 of 5: Final Step
          </div>
          <h1 className="text-5xl md:text-6xl font-black max-w-3xl mx-auto">
            Your AI Sales Agent is Ready!
          </h1>
          <p className="text-stone-500 text-xl font-medium max-w-2xl mx-auto">
            Link your script and voice profiles to activation. Once live,
            Clinchd will monitor your DMs 24/7 to book qualified calls.
          </p>

          {/* Activation Toggle */}
          <div className="flex flex-col items-center justify-center pt-8">
            <div className="bg-white p-8 rounded-[3rem] border border-stone-200 soft-shadow flex flex-col items-center gap-6 animate-[float_6s_ease-in-out_infinite]">
              <div className="flex flex-col items-center gap-4">
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-stone-400">
                  Ready to Activate
                </span>

                {/* Large custom switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={aiActive}
                  onClick={() => {
                    if (!activating) onGoLive(!aiActive);
                  }}
                  disabled={activating || (!aiActive && !scriptReady)}
                  className={`relative inline-flex h-11 w-20 items-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    aiActive ? "bg-[#ff7e67]" : "bg-stone-200"
                  }`}
                >
                  <span
                    className={`inline-block h-9 w-9 transform rounded-full bg-white shadow-lg transition-transform ${
                      aiActive ? "translate-x-[36px]" : "translate-x-0.5"
                    }`}
                  />
                </button>

                <div
                  className={`flex items-center gap-2 ${
                    aiActive ? "text-[#ff7e67]" : "text-stone-400"
                  }`}
                >
                  {aiActive && (
                    <span className="w-2 h-2 bg-[#ff7e67] rounded-full animate-pulse" />
                  )}
                  <span className="text-sm font-black">
                    {activating ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Activating...
                      </span>
                    ) : aiActive ? (
                      "AI AGENT ARMED"
                    ) : (
                      "AI AGENT PAUSED"
                    )}
                  </span>
                </div>

                {!scriptReady && !aiActive && (
                  <p className="text-xs text-stone-400 max-w-xs">
                    You need to configure your script before activating. Go back
                    and generate a script first.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
          {[
            {
              icon: Monitor,
              title: "DMs Monitored",
              desc: "Clinchd scans every incoming Instagram DM in real-time, even while you sleep or work on your business.",
              color: "bg-blue-50 text-blue-500",
            },
            {
              icon: UserCheck,
              title: "Leads Qualified",
              desc: "Every prospect is vetted against your criteria. No more wasted time on low-quality discovery calls.",
              color: "bg-orange-50 text-[#ff7e67]",
            },
            {
              icon: CalendarCheck,
              title: "Calls Booked",
              desc: "When a lead is hot, your Calendly link is dropped automatically. You show up to pre-qualified calls.",
              color: "bg-green-50 text-green-500",
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div
              key={title}
              className="p-8 bg-white rounded-[2.5rem] border border-stone-100 soft-shadow group hover:translate-y-[-4px] transition-transform duration-300"
            >
              <div
                className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform`}
              >
                <Icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black mb-3">{title}</h3>
              <p className="text-stone-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </section>

        {/* Control Section */}
        <section className="bg-stone-900 rounded-[3rem] p-12 text-white relative overflow-hidden mb-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff7e67]/10 blur-[120px] rounded-full" />
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="max-w-xl">
              <span className="text-[#ff7e67] text-xs font-black uppercase tracking-widest">
                Absolute Peace of Mind
              </span>
              <h2 className="text-3xl md:text-4xl font-black mt-4 mb-6">
                You stay in full control
              </h2>
              <p className="text-stone-400 text-lg leading-relaxed">
                We built Clinchd to be your assistant, not your replacement. You
                can jump in, pause, or tweak the AI at any time.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 w-full md:w-auto">
              {[
                {
                  icon: Zap,
                  title: "Manual Override",
                  desc: "Jump into any DM instantly",
                  iconBg: "bg-[#ff7e67]/20 text-[#ff7e67]",
                },
                {
                  icon: PauseCircle,
                  title: "Pause Anytime",
                  desc: "One-click global toggle",
                  iconBg: "bg-white/10 text-white",
                },
                {
                  icon: Eye,
                  title: "Real-Time Monitoring",
                  desc: "Watch every reply live",
                  iconBg: "bg-white/10 text-white",
                },
              ].map(({ icon: Icon, title, desc, iconBg }) => (
                <div
                  key={title}
                  className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10"
                >
                  <div
                    className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center text-xl`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-xs text-stone-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={onGoToDashboard}
              className="px-12 py-6 bg-[#ff7e67] text-white rounded-full text-xl font-black shadow-2xl shadow-[#ff7e67]/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 group"
            >
              {aiActive ? "Go to Dashboard" : "Go Live Now"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onBack}
              className="px-12 py-6 bg-white border-2 border-stone-200 text-stone-900 rounded-full text-xl font-black hover:bg-stone-50 transition-colors"
            >
              Review Script First
            </button>
          </div>
          <p className="text-stone-400 text-sm font-medium">
            You can pause or adjust settings anytime from your dashboard
          </p>
        </div>

        {/* Dashboard Preview Skeleton */}
        <div className="mt-20 p-8 border-2 border-dashed border-stone-200 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-not-allowed group">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff7e67] mb-2">
              Dashboard Preview
            </p>
            <h4 className="text-2xl font-black mb-2">
              Incoming Lead Notification
            </h4>
            <p className="text-sm text-stone-500">
              Once live, you&apos;ll see first replies appear here in less than 2
              minutes.
            </p>
          </div>
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 bg-stone-200 rounded-full" />
            <div className="space-y-1.5">
              <div className="w-24 h-3 bg-stone-200 rounded" />
              <div className="w-40 h-2 bg-stone-200 rounded" />
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-10 border-t border-stone-100 text-center">
        <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} Clinchd &bull; Secure connection via Meta Graph API
        </p>
      </footer>
    </div>
  );
}
