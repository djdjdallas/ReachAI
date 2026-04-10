"use client";

import { useRef, useState } from "react";
import {
  Zap,
  Edit3,
  UserPlus,
  Snowflake,
  AlertCircle,
  Flame,
  Phone,
  Video,
  Info as InfoIcon,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Rocket,
  Loader2,
  Sparkles,
  PenTool,
  X,
} from "lucide-react";

export default function Step4Preview({
  profile,
  greeting,
  setGreeting,
  qualifyingQuestions,
  setQualifyingQuestions,
  interestResponse,
  setInterestResponse,
  objectionHandlers,
  setObjectionHandlers,
  bookingMessage,
  setBookingMessage,
  notAFitMessage,
  setNotAFitMessage,
  humanInLoop,
  setHumanInLoop,
  generating,
  saving,
  onGenerate,
  onSave,
  aiError,
  onDismissError,
  onBack,
}) {
  const [activeScenario, setActiveScenario] = useState("objection");
  const editorRef = useRef(null);

  const scriptConfig = profile?.script_config || {};

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-12 md:py-16">
        {/* Header Section */}
        <header className="max-w-3xl mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4">
            Preview Your AI Sales Script{" "}
            <span className="text-[#ff7e67]">in Action</span>
          </h1>
          <p className="text-xl text-stone-500 font-medium">
            See how Clinchd will respond to real prospects using the data
            you&apos;ve provided.
          </p>
        </header>

        {aiError && (
          <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">{aiError}</div>
            <button
              type="button"
              onClick={onDismissError}
              className="shrink-0 p-1 rounded-md hover:bg-red-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Generate button if no script yet */}
        {!greeting && (
          <div className="mb-8">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="px-8 py-4 bg-[#ff7e67] text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#ff7e67]/20 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {generating ? "Generating..." : "Generate AI Script"}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Script Configuration Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] soft-shadow border border-stone-100">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold">Script Summary</h2>
                <button
                  onClick={() =>
                    editorRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    })
                  }
                  className="text-xs font-black text-[#ff7e67] uppercase tracking-widest hover:underline"
                >
                  Edit Full Script
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                    What You Sell
                  </p>
                  <p className="text-stone-800 font-bold leading-relaxed">
                    {scriptConfig.offer || "Not configured yet"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                    Ideal Customer
                  </p>
                  <p className="text-stone-800 font-bold leading-relaxed">
                    {scriptConfig.targetCustomer || "Not configured yet"}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest mb-2">
                    Handling Objections
                  </p>
                  <p className="text-stone-800 font-bold leading-relaxed">
                    {scriptConfig.objections
                      ? scriptConfig.objections.slice(0, 120) + "..."
                      : "Not configured yet"}
                  </p>
                </div>

                <div className="pt-6 border-t border-stone-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest mb-0.5">
                        Voice Setting
                      </p>
                      <p className="text-sm font-bold text-stone-800">
                        {profile?.voice_profile?.status === "ready"
                          ? "Voice Profile Active"
                          : "Professional & Direct"}
                      </p>
                    </div>
                    <button className="p-2 rounded-xl bg-stone-50 text-stone-400 hover:text-stone-900 transition-colors">
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>

                  <label className="flex items-center justify-between cursor-pointer p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:border-[#ff7e67]/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#ff7e67] shadow-sm">
                        <UserPlus className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-black">Human-in-Loop</p>
                        <p className="text-[11px] text-stone-500 font-medium">
                          Notify me for complex objections
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={humanInLoop}
                      onClick={() => setHumanInLoop(!humanInLoop)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        humanInLoop ? "bg-[#ff7e67]" : "bg-stone-200"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                          humanInLoop ? "translate-x-5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </div>
            </div>

            {/* Test Scenarios */}
            <div className="bg-white p-8 rounded-[2.5rem] soft-shadow border border-stone-100">
              <h3 className="text-sm font-black text-stone-400 uppercase tracking-widest mb-6">
                Choose Test Scenario
              </h3>
              <div className="space-y-3">
                {[
                  {
                    id: "cold",
                    label: "Cold Prospect",
                    icon: Snowflake,
                    activeColor: "text-blue-400",
                  },
                  {
                    id: "objection",
                    label: "Has Objections",
                    icon: AlertCircle,
                    activeColor: "text-[#ff7e67]",
                  },
                  {
                    id: "ready",
                    label: "Ready to Buy",
                    icon: Flame,
                    activeColor: "text-orange-500",
                  },
                ].map(({ id, label, icon: Icon, activeColor }) => (
                  <button
                    key={id}
                    onClick={() => setActiveScenario(id)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                      activeScenario === id
                        ? "border-[#ff7e67] bg-[#fff5f2]"
                        : "border-stone-100 hover:border-stone-200"
                    }`}
                  >
                    <span
                      className={`font-bold ${
                        activeScenario === id
                          ? "font-black text-[#ff7e67]"
                          : "text-stone-600 group-hover:text-stone-900"
                      }`}
                    >
                      {label}
                    </span>
                    <Icon
                      className={`w-5 h-5 ${
                        activeScenario === id
                          ? activeColor
                          : "text-stone-300 group-hover:" + activeColor
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Inline Editor: the 6 script fields */}
            <div
              ref={editorRef}
              className="bg-white p-8 rounded-[2.5rem] soft-shadow border border-stone-100 scroll-mt-24"
            >
              <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-[#ff7e67]" />
                Edit Your Script
              </h3>
              <p className="text-xs text-stone-400 font-medium mb-6">
                Fine-tune the AI-generated script before going live.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block mb-2">
                    Opening Message
                  </label>
                  <textarea
                    rows={3}
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    placeholder="Your first reply when someone messages you..."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/10 focus:border-[#ff7e67] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block mb-2">
                    Qualifying Questions (one per line)
                  </label>
                  <textarea
                    rows={4}
                    value={qualifyingQuestions}
                    onChange={(e) => setQualifyingQuestions(e.target.value)}
                    placeholder={"What's your current situation?\nWhat's your main goal?\nWhat have you tried before?"}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/10 focus:border-[#ff7e67] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block mb-2">
                    When They Show Interest
                  </label>
                  <textarea
                    rows={3}
                    value={interestResponse}
                    onChange={(e) => setInterestResponse(e.target.value)}
                    placeholder="Your response when a lead says they're interested..."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/10 focus:border-[#ff7e67] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block mb-2">
                    Objection Handlers (topic: response, one per line)
                  </label>
                  <textarea
                    rows={5}
                    value={objectionHandlers}
                    onChange={(e) => setObjectionHandlers(e.target.value)}
                    placeholder={"too expensive: the ROI covers the investment...\nnot the right time: when do you think you'd be ready?"}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/10 focus:border-[#ff7e67] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block mb-2">
                    Booking Message
                  </label>
                  <textarea
                    rows={3}
                    value={bookingMessage}
                    onChange={(e) => setBookingMessage(e.target.value)}
                    placeholder="Use {{BOOKING_LINK}} as a placeholder for your Calendly URL..."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/10 focus:border-[#ff7e67] transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 block mb-2">
                    Not-A-Fit Message
                  </label>
                  <textarea
                    rows={3}
                    value={notAFitMessage}
                    onChange={(e) => setNotAFitMessage(e.target.value)}
                    placeholder="Polite decline when a prospect isn't a match..."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/10 focus:border-[#ff7e67] transition-all resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Preview Chat */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-[2.5rem] soft-shadow border border-stone-100 overflow-hidden flex flex-col">
              {/* Mock Instagram Header */}
              <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border border-stone-100 bg-stone-100" />
                  <div>
                    <p className="text-sm font-black">Sample Lead</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                      Preview
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-stone-400">
                  <Phone className="w-4 h-4" />
                  <Video className="w-5 h-5" />
                  <InfoIcon className="w-5 h-5" />
                </div>
              </div>

              {/* Chat Body */}
              <div className="p-8 space-y-8 h-[600px] overflow-y-auto bg-stone-50/30">
                {/* Prospect Message */}
                <div className="flex gap-3 max-w-[85%]">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-stone-200" />
                  </div>
                  <div className="space-y-1">
                    <div className="bg-stone-100 px-5 py-3 text-sm font-medium text-stone-800 leading-relaxed shadow-sm rounded-2xl rounded-tl-none">
                      {activeScenario === "cold"
                        ? "Hey! I saw your page. What exactly do you do?"
                        : activeScenario === "objection"
                        ? "Hey! I saw your program for e-commerce store owners. I'm doing about $55k/month right now, but I'm completely burnt out. How is this different from another course?"
                        : "I'm ready to jump in. What's the next step to get started?"}
                    </div>
                    <p className="text-[10px] text-stone-400 font-bold px-1">
                      10:14 AM
                    </p>
                  </div>
                </div>

                {/* AI Response */}
                <div className="flex gap-3 justify-end ml-auto max-w-[85%]">
                  <div className="space-y-1 text-right">
                    <div className="bg-[#ff7e67] px-5 py-3 text-sm font-medium leading-relaxed shadow-lg shadow-[#ff7e67]/20 text-white rounded-2xl rounded-br-none">
                      <div className="flex items-center gap-2 mb-1 justify-end">
                        <span className="bg-white/20 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                          Clinchd Agent
                        </span>
                      </div>
                      {greeting ||
                        (activeScenario === "cold"
                          ? "Hey! Great to connect. We help e-commerce store owners automate their DM outreach and book more calls. Want me to share how it works?"
                          : activeScenario === "objection"
                          ? "I totally get that burnout, Jordan. Most programs just give you more 'to-do' lists. We focus strictly on building the automated systems so your business scales while you actually step back."
                          : "Love the energy! Let me grab a time that works for a quick call — here's my calendar link.")}
                    </div>
                    <p className="text-[10px] text-stone-400 font-bold px-1 italic">
                      Read 10:16 AM
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-[#ff7e67] rounded-full flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                {activeScenario === "objection" && (
                  <>
                    {/* Prospect Objection */}
                    <div className="flex gap-3 max-w-[85%]">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-stone-200" />
                      </div>
                      <div className="space-y-1">
                        <div className="bg-stone-100 px-5 py-3 text-sm font-bold text-stone-900 leading-relaxed shadow-sm ring-2 ring-orange-100 rounded-2xl rounded-tl-none">
                          Sounds good, but honestly, I&apos;ve spent thousands
                          on systems before that didn&apos;t work. Is there a
                          real ROI here or just more software subscriptions?
                        </div>
                        <p className="text-[10px] text-stone-400 font-bold px-1">
                          10:18 AM
                        </p>
                      </div>
                    </div>

                    {/* AI Objection Handler */}
                    <div className="flex gap-3 justify-end ml-auto max-w-[85%]">
                      <div className="space-y-1 text-right">
                        <div className="bg-[#ff7e67] px-5 py-3 text-sm font-medium leading-relaxed shadow-lg shadow-[#ff7e67]/20 text-white rounded-2xl rounded-br-none">
                          <div className="flex items-center gap-2 mb-1 justify-end">
                            <span className="bg-white/20 text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest">
                              Clinchd Agent
                            </span>
                          </div>
                          {objectionHandlers
                            ? typeof objectionHandlers === "string"
                              ? objectionHandlers.slice(0, 200)
                              : "Fair question! We focus on the ROI of your time. Our average client saves 20+ hours a week within the first 30 days."
                            : "Fair question, Jordan! We don't focus on 'more software.' We focus on the ROI of your time. Our average client at your revenue level saves 20+ hours a week within the first 30 days."}
                        </div>
                        <p className="text-[10px] text-stone-400 font-bold px-1 italic text-[#ff7e67]">
                          Typing...
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-[#ff7e67] rounded-full flex items-center justify-center">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Chat Footer */}
              <div className="p-6 border-t border-stone-100 flex items-center gap-4 bg-white">
                <div className="flex-1 h-12 bg-stone-50 border border-stone-200 rounded-2xl flex items-center px-4 text-stone-300 text-sm font-medium italic">
                  Live simulation running...
                </div>
                <button
                  onClick={onGenerate}
                  disabled={generating}
                  className="p-3 rounded-2xl bg-stone-900 text-white hover:bg-[#ff7e67] transition-all"
                >
                  {generating ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="bg-white border-t border-stone-200 py-6 px-6 sticky bottom-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="px-8 py-4 text-sm font-bold text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="hidden sm:flex px-8 py-4 text-sm font-bold text-stone-500 bg-stone-50 rounded-2xl hover:bg-stone-100 transition-colors"
            >
              Regenerate Preview
            </button>
            <button
              onClick={onSave}
              disabled={saving || !greeting}
              className="px-12 py-4 bg-[#ff7e67] text-white rounded-2xl font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff7e67]/20 flex items-center gap-3 group disabled:opacity-50 disabled:hover:scale-100"
            >
              {saving && <Loader2 className="w-5 h-5 animate-spin" />}
              Next: Go Live
              <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
