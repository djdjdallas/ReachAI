"use client";

import {
  PenTool,
  DollarSign,
  Eye,
  Zap,
  Dumbbell,
  ShoppingBag,
  Layers,
  Briefcase,
  PlusCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";

import OnboardingFooter from "./OnboardingFooter";

const INDUSTRY_PRESETS = [
  {
    id: "fitness",
    icon: Dumbbell,
    title: "Fitness Coaches",
    preview:
      '"Hey [name]! Saw you\'re crushing it in the fitness space. Ever struggle with leads ghosting..."',
    template: {
      offer:
        "12-week 1:1 fitness coaching program for busy professionals who want sustainable results without living in the gym.",
      targetCustomer:
        "Working professionals aged 28-45 who struggle to stay consistent with workouts and nutrition while juggling career and family.",
      objections:
        "Too expensive: a personal coach is an investment in years of better health and energy.\nNot enough time: most of my clients are busier than you and still get results with 30 min/day.",
    },
  },
  {
    id: "ecommerce",
    icon: ShoppingBag,
    title: "E-commerce Brands",
    preview:
      '"Love your products! We help stores recover abandoned carts directly via DMs..."',
    template: {
      offer:
        "DM-based conversion system that turns inbound Instagram DMs into paying customers for Shopify brands doing $10k-50k/mo.",
      targetCustomer:
        "DTC brand owners who get steady inbound DMs but let most of them go cold because they can't respond fast enough.",
      objections:
        "I already have a chatbot: rigid bot flows kill conversions, we replace them with qualified 1:1 conversations.\nToo expensive: the average client recovers the cost in the first week of recovered DM conversions.",
    },
  },
  {
    id: "saas",
    icon: Layers,
    title: "SaaS Founders",
    preview:
      '"Automation is the name of the game. I saw your SaaS platform and thought..."',
    template: {
      offer:
        "1:1 onboarding accelerator for early-stage SaaS founders bottlenecked on manual customer setup.",
      targetCustomer:
        "Pre-Series A founders doing $5k-30k MRR who are losing 10+ hours a week to onboarding and support.",
      objections:
        "We can hire for this later: hiring is 6+ weeks and a wrong hire sets you back months.\nWe don't have budget: this pays for itself once you free 10 hours a week of founder time.",
    },
  },
  {
    id: "consultants",
    icon: Briefcase,
    title: "Consultants / Agencies",
    preview:
      '"Expertise is scalable. Clinchd helps consultants pre-qualify inbound interests..."',
    template: {
      offer:
        "Done-with-you pipeline system for independent consultants who want predictable inbound leads.",
      targetCustomer:
        "Freelance consultants and small agency owners billing $5k-20k per project who rely on unpredictable referrals.",
      objections:
        "I already get referrals: referrals are unpredictable, this builds a repeatable pipeline.\nToo expensive: one new client typically covers the full program.",
    },
  },
];

export default function Step2Script({
  offer,
  setOffer,
  targetCustomer,
  setTargetCustomer,
  objections,
  setObjections,
  calendlyUrl,
  setCalendlyUrl,
  saving,
  generating,
  onSave,
  onGenerate,
  onApplyPreset,
  aiError,
  onDismissError,
  onBack,
  autoImporting = false,
  autoImportedSource = null,
}) {
  const charCount = offer.length;

  const canContinue = !!offer && !!targetCustomer;

  return (
    <div className="flex-1 flex flex-col">
    <div className="flex-1 max-w-7xl mx-auto w-full px-8 py-10">
      <div className="mb-10 text-center">
        <h2 className="text-4xl font-extrabold mb-3">
          Step 2: Create Your Sales Script
        </h2>
        <p className="text-stone-500 font-medium">
          Write your opening message, handle objections, and let AI personalize
          it in your voice.
        </p>
      </div>

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

      {autoImporting && (
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-[#ff7e67]/20 bg-[#fff5f2] p-4 text-sm text-stone-700">
          <Loader2 className="w-4 h-4 animate-spin text-[#ff7e67]" />
          <span className="font-medium">Personalizing your script from your Instagram...</span>
        </div>
      )}

      {!autoImporting && autoImportedSource === "instagram_auto" && (
        <div
          className="mb-8 flex items-start gap-3 rounded-2xl border border-[#ff7e67]/20 bg-[#fff5f2] p-4 text-sm text-stone-700"
          title="We pre-filled this from your Instagram bio and recent posts. You can edit anything below."
        >
          <Sparkles className="w-4 h-4 text-[#ff7e67] shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Generated from your Instagram.</span>{" "}
            <span className="text-stone-600">
              Review and adjust the offer, customer, and objections below.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Panel: Script Editor */}
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white rounded-3xl p-8 soft-shadow border border-stone-100">
            <div className="flex items-center mb-6">
              <h3 className="text-xl font-extrabold flex items-center gap-3">
                <PenTool className="w-5 h-5 text-[#ff7e67]" />
                Script Configuration
              </h3>
            </div>

            <div className="space-y-6">
              {/* Opening Message / What you sell */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-sm font-black text-stone-400 uppercase tracking-widest">
                    What do you sell?
                  </label>
                  <span className="text-[11px] text-stone-400">
                    {charCount} / 500 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="e.g., I sell a 12-week coaching program that helps agency owners scale to $50k/month..."
                  className="w-full px-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/5 focus:border-[#ff7e67] transition-all resize-none font-medium"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  maxLength={500}
                />
              </div>

              {/* Ideal Customer */}
              <div>
                <label className="text-sm font-black text-stone-400 uppercase tracking-widest block mb-2">
                  Who is your ideal customer?
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Agency owners doing $10-30k/month who want to scale but are stuck doing all the fulfillment..."
                  className="w-full px-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/5 focus:border-[#ff7e67] transition-all resize-none font-medium"
                  value={targetCustomer}
                  onChange={(e) => setTargetCustomer(e.target.value)}
                />
              </div>

              {/* Objection Handlers */}
              <div className="space-y-4">
                <label className="text-sm font-black text-stone-400 uppercase tracking-widest block">
                  Common Objection Handlers
                </label>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-[#fff5f2] rounded-lg w-fit">
                    <DollarSign className="w-3 h-3 text-[#ff7e67]" />
                    <span className="text-[10px] font-black text-[#ff7e67] uppercase tracking-widest">
                      Price &amp; Other Objections
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    placeholder={`e.g., "I don't have time" — We actually help you free up time...\n"It's too expensive" — The ROI typically covers the investment within the first month...`}
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/5 transition-all font-medium resize-none"
                    value={objections}
                    onChange={(e) => setObjections(e.target.value)}
                  />
                </div>
              </div>

              {/* Call to Action / Booking Link */}
              <div>
                <label className="text-sm font-black text-stone-400 uppercase tracking-widest block mb-2">
                  Booking Link (Calendly / Cal.com)
                </label>
                <div className="relative">
                  <input
                    type="url"
                    placeholder="https://calendly.com/yourname/30min"
                    className="w-full px-5 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-[#ff7e67]/5 transition-all font-bold text-stone-900"
                    value={calendlyUrl}
                    onChange={(e) => setCalendlyUrl(e.target.value)}
                  />
                </div>

                {/* Calendly webhook setup instructions — ensures booked calls
                    update the conversation status automatically. */}
                <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 text-xs text-stone-600 leading-relaxed space-y-2">
                  <p className="font-bold text-stone-900">
                    Optional: auto-mark bookings as confirmed
                  </p>
                  <p>
                    In Calendly, open{" "}
                    <strong>Integrations → Webhooks</strong> and add this URL:
                  </p>
                  <code className="block rounded-lg bg-white border border-stone-200 px-3 py-2 text-[11px] text-stone-800 font-mono break-all">
                    https://www.clinchd.io/api/webhooks/calendly
                  </code>
                  <p>
                    Subscribe to the{" "}
                    <strong>invitee.created</strong> and{" "}
                    <strong>invitee.canceled</strong> events. Copy the signing
                    secret Calendly gives you — our team will paste it into
                    your Clinchd environment so bookings flow back into your
                    dashboard. Until that&apos;s wired up, the AI still sends
                    the link; you just won&apos;t see bookings auto-confirm.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                onClick={onSave}
                disabled={saving || !offer || !targetCustomer}
                className="flex-1 py-4 bg-stone-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#ff7e67] transition-all disabled:opacity-50 disabled:hover:bg-stone-900"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                {saving ? "Saving..." : "Save Draft"}
              </button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-stone-900 rounded-[2rem] p-8 text-white soft-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-lg">
                <Eye className="w-5 h-5 text-[#ff7e67]" />
              </div>
              <h3 className="text-xl font-extrabold">Live DM Preview</h3>
              <span className="ml-auto text-xs text-stone-400">
                Simulated Instagram View
              </span>
            </div>

            <div className="space-y-6">
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-8 h-8 rounded-full bg-white/20 flex-shrink-0" />
                <div className="bg-white/10 p-4 rounded-2xl rounded-tl-none text-xs leading-relaxed">
                  Hey! Saw your post. How does Clinchd handle objection handling?
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex gap-3 justify-end ml-auto max-w-[85%]">
                  <div className="bg-[#ff7e67] px-5 py-4 rounded-2xl rounded-br-none text-xs leading-relaxed">
                    <span className="font-bold block mb-1 opacity-80 uppercase tracking-tighter text-[10px]">
                      Clinchd
                    </span>
                    {objections
                      ? objections.slice(0, 150) + (objections.length > 150 ? "..." : "")
                      : "Your objection handler response will preview here..."}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#ff7e67] flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                </div>
                <span className="text-[9px] text-stone-500 font-bold uppercase tracking-widest mr-11">
                  Typing with human delay...
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel: AI Suggestions */}
        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white rounded-3xl p-8 soft-shadow border border-stone-100">
            <div className="mb-8">
              <h3 className="text-xl font-extrabold">Industry Presets</h3>
              <p className="text-xs text-stone-400 font-medium mt-1">
                Click to fill the form with a starter template for your niche
              </p>
            </div>

            <div className="space-y-4">
              {INDUSTRY_PRESETS.map(({ id, icon: Icon, title, preview, template }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => onApplyPreset && onApplyPreset(template)}
                  className="group w-full text-left p-5 rounded-2xl border border-stone-100 bg-stone-50 hover:bg-white hover:border-[#ff7e67]/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:text-[#ff7e67]">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-black">{title}</span>
                    </div>
                    <PlusCircle className="w-5 h-5 text-stone-300 group-hover:text-[#ff7e67] transition-colors" />
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed italic">
                    {preview}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-10 p-6 bg-stone-900 rounded-3xl text-center relative overflow-hidden">
              <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-[#ff7e67] rounded-full blur-2xl opacity-20" />
              <p className="text-stone-300 text-xs font-medium mb-4 relative z-10">
                Don&apos;t know what to write? Let our AI analyze your website
                and write the script for you.
              </p>
              <button
                onClick={onGenerate}
                disabled={generating || !offer || !targetCustomer}
                className="w-full py-3 bg-[#ff7e67] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#ff7e67]/20 hover:scale-[1.02] transition-all relative z-10 disabled:opacity-50"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </span>
                ) : (
                  "Write My Script with AI"
                )}
              </button>
            </div>
          </div>

          <div className="bg-orange-50/50 p-6 rounded-3xl border border-[#ff7e67]/10 flex gap-4 items-start">
            <AlertCircle className="w-5 h-5 text-[#ff7e67] mt-1" />
            <div>
              <h4 className="text-sm font-black text-stone-900 uppercase tracking-widest">
                Pro Tip
              </h4>
              <p className="text-xs text-stone-500 leading-relaxed mt-1">
                Using variables like{" "}
                <span className="text-[#ff7e67] font-bold">[name]</span> and{" "}
                <span className="text-[#ff7e67] font-bold">[niche]</span>{" "}
                increases response rates by up to{" "}
                <span className="font-bold text-stone-900">42%</span>. Clinchd
                fills these in automatically.
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
      <OnboardingFooter
        onBack={onBack}
        onPrimary={onSave}
        primaryLabel="Save & Continue"
        primaryDisabled={!canContinue}
        primaryLoading={saving}
        primaryTooltip="Fill in what you sell and your ideal customer to continue."
        completion="40% Ready"
      />
    </div>
  );
}
