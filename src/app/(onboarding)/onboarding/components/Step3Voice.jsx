"use client";

import {
  Mic2,
  Sparkles,
  PenTool,
  Info,
  Zap,
  Lightbulb,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Check,
  ClipboardPaste,
  MessageCircle,
  Send,
  Bot,
  User,
  AlertCircle,
  X,
} from "lucide-react";

export default function Step3Voice({
  voiceProfile,
  voiceMode,
  setVoiceMode,
  sampleText,
  setSampleText,
  analyzingVoice,
  onAnalyzeVoice,
  voiceChatMessages,
  voiceChatInput,
  setVoiceChatInput,
  voiceChatLoading,
  finalizingVoice,
  onStartVoiceChat,
  onSendVoiceChat,
  onFinalizeVoiceChat,
  sampleMessageCount,
  tone,
  setTone,
  traits,
  setTraits,
  responseLength,
  setResponseLength,
  aiError,
  onDismissError,
  onRevertVoice,
  onBack,
  onNext,
}) {
  const selectedTone = tone;

  const tones = [
    {
      id: "professional",
      title: "Professional & Formal",
      desc: "Structured, polished, and respectful. Best for high-end B2B services.",
    },
    {
      id: "friendly",
      title: "Friendly & Casual",
      desc: "Warm, inviting, and human. Best for coaches and personal brands.",
    },
    {
      id: "direct",
      title: "Direct & Sales-Focused",
      desc: "Goal-oriented, punchy, and assertive. Best for fast-moving sales cycles.",
    },
    {
      id: "supportive",
      title: "Helpful & Supportive",
      desc: "Empathetic, patient, and clear. Best for service providers and creators.",
    },
  ];

  const toneLabels = {
    professional: "Professional & Formal",
    friendly: "Friendly & Casual",
    direct: "Direct & Sales-Focused",
    supportive: "Helpful & Supportive",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-black mb-2">Your Voice</h1>
            <p className="text-stone-500 text-lg font-medium">
              How should Clinchd talk to your leads? Set your tone, personality,
              and response style.
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Left Column: Configuration */}
            <div className="lg:col-span-7 space-y-8">
              {/* Tone Selection */}
              <div className="bg-white rounded-3xl p-8 soft-shadow border border-stone-100">
                <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                  <Mic2 className="w-5 h-5 text-[#ff7e67]" />
                  1. Select Your Core Tone
                </h3>
                {voiceProfile?.status === "ready" && (
                  <p className="text-xs text-stone-500 mb-6 font-medium">
                    Your analyzed voice is active — tone is used as a fallback
                    only if you clear your voice profile.
                  </p>
                )}
                {!voiceProfile?.status && (
                  <div className="mb-6" />
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tones.map((tone) => (
                    <label
                      key={tone.id}
                      className={`block p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                        selectedTone === tone.id
                          ? "border-[#ff7e67] bg-[#fff5f2]"
                          : "border-stone-100 hover:border-stone-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="tone"
                        value={tone.id}
                        checked={selectedTone === tone.id}
                        onChange={() => setTone(tone.id)}
                        className="hidden"
                      />
                      <p className="font-bold text-sm mb-1">{tone.title}</p>
                      <p className="text-xs text-stone-500">{tone.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Personality Traits */}
              <div className="bg-white rounded-3xl p-8 soft-shadow border border-stone-100">
                <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#ff7e67]" />
                  2. Personality Traits
                </h3>
                <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                  {[
                    { key: "emojis", label: "Use Emojis" },
                    { key: "questions", label: "Ask Questions" },
                    { key: "stories", label: "Tell Brief Stories" },
                    { key: "humor", label: "Use Humor" },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm font-bold text-stone-700">
                        {label}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={traits[key]}
                        onClick={() =>
                          setTraits((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                          traits[key] ? "bg-[#ff7e67]" : "bg-stone-200"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                            traits[key] ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-10">
                  <p className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4">
                    Response Length
                  </p>
                  <div className="flex bg-stone-50 p-1 rounded-2xl border border-stone-200">
                    {["short", "medium", "long"].map((len) => (
                      <button
                        key={len}
                        onClick={() => setResponseLength(len)}
                        className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all capitalize ${
                          responseLength === len
                            ? "bg-white text-[#ff7e67] shadow-sm"
                            : ""
                        }`}
                      >
                        {len}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Brand Voice Sample */}
              <div className="bg-white rounded-3xl p-8 soft-shadow border border-stone-100">
                <h3 className="text-lg font-black mb-2 flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-[#ff7e67]" />
                  3. Brand Voice Sample
                </h3>
                <p className="text-xs text-stone-500 mb-6 font-medium">
                  Paste real messages you&apos;ve sent — DMs, texts, or social
                  posts. One per line (minimum 3).
                </p>

                {voiceProfile?.status === "ready" && !voiceMode ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-stone-50 p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">
                          Voice profile captured
                        </span>
                      </div>
                      <p className="text-sm italic text-stone-700">
                        &ldquo;{voiceProfile.voice_summary}&rdquo;
                      </p>
                      {/* Confidence indicator */}
                      {(() => {
                        const count = voiceProfile.sample_count || 0;
                        const isStrong = count >= 8;
                        const isOk = count >= 5;
                        return (
                          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                            isStrong
                              ? "bg-green-50 text-green-700"
                              : isOk
                              ? "bg-amber-50 text-amber-700"
                              : "bg-amber-50 text-amber-700"
                          }`}>
                            <div className={`flex gap-0.5`}>
                              {[1, 2, 3].map((bar) => (
                                <div
                                  key={bar}
                                  className={`w-1 rounded-full ${
                                    bar === 1
                                      ? "h-2"
                                      : bar === 2
                                      ? "h-3"
                                      : "h-4"
                                  } ${
                                    (bar === 1) ||
                                    (bar === 2 && isOk) ||
                                    (bar === 3 && isStrong)
                                      ? isStrong ? "bg-green-500" : "bg-amber-500"
                                      : "bg-stone-200"
                                  }`}
                                />
                              ))}
                            </div>
                            {isStrong
                              ? `Strong profile (${count} samples)`
                              : `${count} sample${count !== 1 ? "s" : ""} analyzed — add ${8 - count}+ more for a stronger profile`}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <button
                        onClick={() => setVoiceMode("paste")}
                        className="text-sm text-[#ff7e67] font-bold flex items-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Re-analyze with new samples
                      </button>
                      {voiceProfile.previous_profile && onRevertVoice && (
                        <button
                          onClick={onRevertVoice}
                          className="text-sm text-stone-500 font-bold flex items-center gap-1 hover:text-stone-700 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Revert to previous
                        </button>
                      )}
                      <a
                        href="/playground"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-stone-500 font-bold flex items-center gap-1 hover:text-stone-700 transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Test in Playground
                      </a>
                    </div>
                  </div>
                ) : voiceMode === "paste" ? (
                  <div className="space-y-4">
                    <textarea
                      rows={6}
                      placeholder={`Paste real messages you've sent — DMs, texts, or social posts. One message per line.\n\nExample:\nhey! saw your post, that's fire. what made you start your agency?\nhonestly that's impressive for 6 months in. what's your biggest bottleneck rn?`}
                      className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67] transition-all resize-none"
                      value={sampleText}
                      onChange={(e) => setSampleText(e.target.value)}
                    />
                    <p className="text-xs text-stone-400">
                      {sampleMessageCount} message
                      {sampleMessageCount !== 1 ? "s" : ""} detected
                      {sampleMessageCount < 3
                        ? " (minimum 3 needed)"
                        : sampleMessageCount < 5
                        ? " (5+ recommended)"
                        : ""}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={onAnalyzeVoice}
                        disabled={analyzingVoice || sampleMessageCount < 3}
                        className="px-6 py-3 bg-[#ff7e67] text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                      >
                        {analyzingVoice ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        {analyzingVoice ? "Analyzing..." : "Analyze My Voice"}
                      </button>
                      <button
                        onClick={() => {
                          setVoiceMode(null);
                          setSampleText("");
                        }}
                        className="px-6 py-3 bg-stone-100 rounded-xl text-sm font-bold text-stone-600"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : voiceMode === "chat" ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border bg-stone-50 p-4 max-h-72 overflow-y-auto space-y-3">
                      {voiceChatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${
                            msg.role === "assistant"
                              ? "justify-start"
                              : "justify-end"
                          } mb-2`}
                        >
                          <div
                            className={`flex items-start gap-2 max-w-[80%] ${
                              msg.role === "assistant"
                                ? "flex-row"
                                : "flex-row-reverse"
                            }`}
                          >
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                                msg.role === "assistant"
                                  ? "bg-[#ff7e67]/15 text-[#ff7e67]"
                                  : "bg-stone-200 text-stone-600"
                              }`}
                            >
                              {msg.role === "assistant" ? (
                                <Bot className="h-3.5 w-3.5" />
                              ) : (
                                <User className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div
                              className={`rounded-2xl px-4 py-2.5 text-sm ${
                                msg.role === "assistant"
                                  ? "bg-white text-stone-800 rounded-tl-sm border border-stone-100"
                                  : "bg-[#ff7e67] text-white rounded-tr-sm"
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      ))}
                      {voiceChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white rounded-2xl px-4 py-2.5 rounded-tl-sm border border-stone-100">
                            <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={voiceChatInput}
                        onChange={(e) => setVoiceChatInput(e.target.value)}
                        placeholder="Type naturally, like you'd message a client..."
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            onSendVoiceChat();
                          }
                        }}
                        disabled={voiceChatLoading}
                        className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67]"
                      />
                      <button
                        onClick={onSendVoiceChat}
                        disabled={voiceChatLoading || !voiceChatInput.trim()}
                        className="p-3 bg-[#ff7e67] text-white rounded-xl disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {voiceChatMessages.filter((m) => m.role === "user")
                        .length >= 3 && (
                        <button
                          onClick={onFinalizeVoiceChat}
                          disabled={finalizingVoice}
                          className="px-6 py-3 bg-[#ff7e67] text-white rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                          {finalizingVoice ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {finalizingVoice ? "Saving..." : "Finish & Save"}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setVoiceMode(null);
                        }}
                        className="px-6 py-3 bg-stone-100 rounded-xl text-sm font-bold text-stone-600"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setVoiceMode("paste")}
                      className="flex-1 rounded-2xl border-2 border-dashed border-stone-200 p-6 text-center hover:border-[#ff7e67]/50 hover:bg-[#fff5f2] transition-colors"
                    >
                      <ClipboardPaste className="h-8 w-8 mx-auto mb-2 text-stone-400" />
                      <p className="text-sm font-bold">
                        Paste Sample Messages
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        Paste 5+ real DMs, texts, or posts
                      </p>
                    </button>
                    <button
                      onClick={() => {
                        setVoiceMode("chat");
                        onStartVoiceChat();
                      }}
                      className="flex-1 rounded-2xl border-2 border-dashed border-stone-200 p-6 text-center hover:border-[#ff7e67]/50 hover:bg-[#fff5f2] transition-colors"
                    >
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 text-stone-400" />
                      <p className="text-sm font-bold">Chat with AI</p>
                      <p className="text-xs text-stone-500 mt-1">
                        Quick conversation to capture your style
                      </p>
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 text-[#ff7e67]">
                  <Info className="w-4 h-4" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    This helps Clinchd match your authentic voice
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Preview */}
            <div className="lg:col-span-5">
              <div className="sticky top-32 space-y-6">
                <div className="bg-stone-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#ff7e67]/20 rounded-full blur-3xl" />

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-extrabold">Voice Preview</h3>
                      <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest text-stone-300">
                        {voiceProfile?.status === "ready" && voiceProfile?.voice_traits?.tone
                          ? voiceProfile.voice_traits.tone
                          : toneLabels[selectedTone]}
                      </div>
                    </div>

                    <div className="space-y-6">
                      {voiceProfile?.status === "ready" && voiceProfile?.preview_replies?.length >= 2 ? (
                        /* Dynamic preview — generated from the user's actual voice */
                        voiceProfile.preview_replies.slice(0, 2).map((pr, i) => (
                          <div key={i} className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-700 flex-shrink-0 flex items-center justify-center text-xs">
                                L
                              </div>
                              <div className="bg-stone-800 p-3 rounded-2xl rounded-tl-none text-xs text-stone-300">
                                {pr.lead_message}
                              </div>
                            </div>
                            <div className="flex items-start gap-3 justify-end">
                              <div className="bg-[#ff7e67] p-4 rounded-2xl rounded-tr-none text-xs text-white max-w-[85%] leading-relaxed">
                                {pr.reply}
                              </div>
                              <div className="w-8 h-8 rounded-full bg-[#ff7e67]/30 flex-shrink-0 flex items-center justify-center">
                                <Zap className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        /* Static fallback preview */
                        <>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-700 flex-shrink-0 flex items-center justify-center text-xs">
                                L
                              </div>
                              <div className="bg-stone-800 p-3 rounded-2xl rounded-tl-none text-xs text-stone-300">
                                How much does this cost?
                              </div>
                            </div>
                            <div className="flex items-start gap-3 justify-end">
                              <div className="bg-[#ff7e67] p-4 rounded-2xl rounded-tr-none text-xs text-white max-w-[85%] leading-relaxed">
                                Great question! The base plan is $49/mo and it
                                basically pays for itself with the first call you
                                book. Would you like to see the full breakdown?
                                {traits.emojis ? " \ud83d\ude0a" : ""}
                              </div>
                              <div className="w-8 h-8 rounded-full bg-[#ff7e67]/30 flex-shrink-0 flex items-center justify-center">
                                <Zap className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-stone-700 flex-shrink-0 flex items-center justify-center text-xs">
                                L
                              </div>
                              <div className="bg-stone-800 p-3 rounded-2xl rounded-tl-none text-xs text-stone-300">
                                How does this work?
                              </div>
                            </div>
                            <div className="flex items-start gap-3 justify-end">
                              <div className="bg-[#ff7e67] p-4 rounded-2xl rounded-tr-none text-xs text-white max-w-[85%] leading-relaxed">
                                It&apos;s super simple. Clinchd monitors your DMs
                                24/7, qualifies leads based on your script, and
                                drops your Calendly link when they&apos;re ready to
                                talk!{traits.emojis ? " \ud83d\ude80" : ""}
                              </div>
                              <div className="w-8 h-8 rounded-full bg-[#ff7e67]/30 flex-shrink-0 flex items-center justify-center">
                                <Zap className="w-3 h-3 text-white" />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="mt-10 pt-8 border-t border-white/10">
                      {voiceProfile?.status === "ready" && voiceProfile?.voice_traits ? (
                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                          {[
                            { label: "Tone", value: voiceProfile.voice_traits.tone },
                            { label: "Formality", value: voiceProfile.voice_traits.formality },
                            { label: "Sentences", value: voiceProfile.voice_traits.sentence_length },
                            { label: "Personality", value: voiceProfile.voice_traits.personality },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">
                                {label}
                              </p>
                              <p className="text-xs text-stone-300 leading-relaxed">
                                {value || "—"}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase">
                              <span>Professionalism</span>
                              <span>
                                {selectedTone === "professional"
                                  ? "90%"
                                  : selectedTone === "direct"
                                  ? "75%"
                                  : "60%"}
                              </span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full">
                              <div
                                className="h-full bg-white/40 rounded-full transition-all"
                                style={{
                                  width:
                                    selectedTone === "professional"
                                      ? "90%"
                                      : selectedTone === "direct"
                                      ? "75%"
                                      : "60%",
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase">
                              <span>Friendliness</span>
                              <span>
                                {selectedTone === "friendly"
                                  ? "92%"
                                  : selectedTone === "supportive"
                                  ? "88%"
                                  : "65%"}
                              </span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full">
                              <div
                                className="h-full bg-[#ff7e67] rounded-full transition-all"
                                style={{
                                  width:
                                    selectedTone === "friendly"
                                      ? "92%"
                                      : selectedTone === "supportive"
                                      ? "88%"
                                      : "65%",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-[#fff5f2] p-6 rounded-3xl border border-[#ff7e67]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center soft-shadow">
                      <Lightbulb className="w-5 h-5 text-[#ff7e67]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Quick Tip</p>
                      <p className="text-[11px] text-stone-600 leading-relaxed">
                        Friendly tones typically see a{" "}
                        <span className="text-[#ff7e67] font-bold">
                          14% higher
                        </span>{" "}
                        response rate on Instagram.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Navigation Footer */}
      <footer className="bg-white border-t border-stone-200 py-6 px-8 mt-auto sticky bottom-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="px-8 py-4 text-stone-400 hover:text-stone-900 font-bold transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous Step
          </button>
          <div className="hidden md:flex flex-col items-center">
            <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
              Completion
            </div>
            <div className="text-sm font-black">60% Ready</div>
          </div>
          <button
            onClick={onNext}
            className="px-10 py-4 bg-[#ff7e67] text-white rounded-full font-black text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#ff7e67]/20 flex items-center gap-3"
          >
            {voiceProfile?.status === "ready"
              ? "Continue to Preview"
              : "Skip for now"}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
