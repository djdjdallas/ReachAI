"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import { Loader2 } from "lucide-react";

import OnboardingHeader from "./components/OnboardingHeader";
import Step1Connect from "./components/Step1Connect";
import Step2Script from "./components/Step2Script";
import Step3Voice from "./components/Step3Voice";
import Step4Preview from "./components/Step4Preview";
import Step5GoLive from "./components/Step5GoLive";

export default function OnboardingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
          <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
        </div>
      }
    >
      <OnboardingPage />
    </Suspense>
  );
}

function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [step, setStep] = useState(() => {
    const urlStep = parseInt(searchParams.get("step"), 10);
    return urlStep >= 1 && urlStep <= 5 ? urlStep : 1;
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // Step 2 form fields
  const [offer, setOffer] = useState("");
  const [targetCustomer, setTargetCustomer] = useState("");
  const [objections, setObjections] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");

  // Step 4 generated script fields
  const [greeting, setGreeting] = useState("");
  const [qualifyingQuestions, setQualifyingQuestions] = useState("");
  const [interestResponse, setInterestResponse] = useState("");
  const [objectionHandlers, setObjectionHandlers] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [notAFitMessage, setNotAFitMessage] = useState("");

  // Step 3 — Voice Profile
  const [voiceProfile, setVoiceProfile] = useState(null);
  const [voiceMode, setVoiceMode] = useState(null); // null | "paste" | "chat"
  const [sampleText, setSampleText] = useState("");
  const [analyzingVoice, setAnalyzingVoice] = useState(false);
  const [voiceChatMessages, setVoiceChatMessages] = useState([]);
  const [voiceChatInput, setVoiceChatInput] = useState("");
  const [voiceChatLoading, setVoiceChatLoading] = useState(false);
  const [finalizingVoice, setFinalizingVoice] = useState(false);

  // Step 5
  const [aiActive, setAiActive] = useState(false);
  const [activating, setActivating] = useState(false);

  // AI/API errors surfaced to the user
  const [aiError, setAiError] = useState(null);
  const dismissError = () => setAiError(null);

  // Persisted user preferences (Step 3 + Step 4 controls)
  const [tone, setTone] = useState("professional");
  const [traits, setTraits] = useState({
    emojis: true,
    questions: true,
    stories: false,
    humor: false,
  });
  const [responseLength, setResponseLength] = useState("medium");
  const [humanInLoop, setHumanInLoop] = useState(true);

  // Warn before navigating away during an active voice chat interview
  useEffect(() => {
    if (voiceMode !== "chat" || voiceChatMessages.length === 0) return;
    const handler = (e) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [voiceMode, voiceChatMessages.length]);

  useEffect(() => {
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        router.push("/login");
        return;
      }

      setUser(authUser);

      const { data: userProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);

        // Pre-populate form fields from existing config
        if (userProfile.script_config) {
          const config = userProfile.script_config;
          setOffer(config.offer || "");
          setTargetCustomer(config.targetCustomer || "");
          setObjections(config.objections || "");
          setGreeting(config.greeting || "");
          setQualifyingQuestions(
            Array.isArray(config.qualifying_questions)
              ? config.qualifying_questions.join("\n")
              : config.qualifying_questions || ""
          );
          setInterestResponse(config.interest_response || "");
          setObjectionHandlers(
            typeof config.objection_handlers === "object" &&
              !Array.isArray(config.objection_handlers)
              ? Object.entries(config.objection_handlers)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")
              : config.objection_handlers || ""
          );
          setBookingMessage(config.booking_message || "");
          setNotAFitMessage(config.not_a_fit_message || "");

          // Persisted user preferences
          if (config.tone) setTone(config.tone);
          if (config.traits && typeof config.traits === "object") {
            setTraits((prev) => ({ ...prev, ...config.traits }));
          }
          if (config.response_length) setResponseLength(config.response_length);
          if (typeof config.human_in_loop === "boolean") {
            setHumanInLoop(config.human_in_loop);
          }
        }
        if (userProfile.calendly_url) {
          setCalendlyUrl(userProfile.calendly_url);
        }
        if (userProfile.voice_profile) {
          setVoiceProfile(userProfile.voice_profile);
          if (userProfile.voice_profile.suggested_response_length) {
            setResponseLength(userProfile.voice_profile.suggested_response_length);
          }
        }

        // Auto-advance: if Instagram is connected and user is on step 1, go to step 2
        const urlStep = parseInt(searchParams.get("step"), 10);
        if (
          (userProfile.unipile_account_id ||
            userProfile.instagram_business_account_id) &&
          (!urlStep || urlStep <= 1)
        ) {
          setStep(2);
        }
      }

      setLoading(false);
    }

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---

  const handleApplyPreset = ({ offer: o, targetCustomer: t, objections: obj }) => {
    setAiError(null);
    setOffer(o);
    setTargetCustomer(t);
    setObjections(obj);
  };

  const handleSaveScriptConfig = async () => {
    setAiError(null);
    setSaving(true);
    try {
      const scriptConfig = {
        ...(profile?.script_config || {}),
        ...(greeting && { greeting }),
        ...(qualifyingQuestions && {
          qualifying_questions: qualifyingQuestions,
        }),
        ...(interestResponse && { interest_response: interestResponse }),
        ...(objectionHandlers && { objection_handlers: objectionHandlers }),
        ...(bookingMessage && { booking_message: bookingMessage }),
        ...(notAFitMessage && { not_a_fit_message: notAFitMessage }),
      };

      // Always overwrite core + preference fields
      scriptConfig.offer = offer;
      scriptConfig.targetCustomer = targetCustomer;
      scriptConfig.objections = objections;
      scriptConfig.tone = tone;
      scriptConfig.traits = traits;
      scriptConfig.response_length = responseLength;
      scriptConfig.human_in_loop = humanInLoop;

      const { error: dbErr } = await supabase
        .from("users")
        .update({
          script_config: scriptConfig,
          calendly_url: calendlyUrl,
        })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      setProfile((prev) => ({
        ...prev,
        script_config: scriptConfig,
        calendly_url: calendlyUrl,
      }));

      setStep(3);
      posthog.capture("onboarding_step_completed", { step: 2 });
    } catch (err) {
      console.error("Error saving script config:", err);
      setAiError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateScript = async () => {
    setAiError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offer,
          targetCustomer,
          objections,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error || "Failed to generate script.");
        return;
      }

      if (data.script) {
        const script = data.script;
        setGreeting(script.greeting || "");
        setQualifyingQuestions(
          Array.isArray(script.qualifying_questions)
            ? script.qualifying_questions.join("\n")
            : script.qualifying_questions || ""
        );
        setInterestResponse(script.interest_response || "");
        setObjectionHandlers(
          typeof script.objection_handlers === "object" &&
            !Array.isArray(script.objection_handlers)
            ? Object.entries(script.objection_handlers)
                .map(([k, v]) => `${k}: ${v}`)
                .join("\n")
            : script.objection_handlers || ""
        );
        setBookingMessage(script.booking_message || "");
        setNotAFitMessage(script.not_a_fit_message || "");
      }
    } catch (err) {
      console.error("Error generating script:", err);
      setAiError(err?.message || "An unexpected error occurred.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveGeneratedScript = async () => {
    setAiError(null);
    setSaving(true);
    try {
      const scriptConfig = {
        ...(profile?.script_config || {}),
        offer,
        targetCustomer,
        objections,
        greeting,
        qualifying_questions: qualifyingQuestions,
        interest_response: interestResponse,
        objection_handlers: objectionHandlers,
        booking_message: bookingMessage,
        not_a_fit_message: notAFitMessage,
        tone,
        traits,
        response_length: responseLength,
        human_in_loop: humanInLoop,
      };

      const { error: dbErr } = await supabase
        .from("users")
        .update({ script_config: scriptConfig })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      setProfile((prev) => ({ ...prev, script_config: scriptConfig }));
      setStep(5);
      posthog.capture("onboarding_step_completed", { step: 4 });
    } catch (err) {
      console.error("Error saving generated script:", err);
      setAiError(err?.message || "Failed to save script.");
    } finally {
      setSaving(false);
    }
  };

  // Voice handlers
  const sampleMessageCount = sampleText
    .split("\n")
    .filter((m) => m.trim().length > 0).length;

  const handleAnalyzeVoice = async () => {
    const messages = sampleText
      .split("\n")
      .map((m) => m.trim())
      .filter((m) => m.length > 0);

    if (messages.length < 3) return;

    setAiError(null);
    setAnalyzingVoice(true);
    try {
      const res = await fetch("/api/ai/analyze-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample_messages: messages }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error || "Failed to analyze voice.");
        return;
      }
      if (data.voice_profile) {
        setVoiceProfile(data.voice_profile);
        setVoiceMode(null);
        setSampleText("");
        if (data.voice_profile.suggested_response_length) {
          setResponseLength(data.voice_profile.suggested_response_length);
        }
        posthog.capture("voice_analyzed", {
          method: "paste",
          source: "onboarding",
        });
      }
    } catch (err) {
      console.error("Error analyzing voice:", err);
      setAiError(err?.message || "An unexpected error occurred.");
    } finally {
      setAnalyzingVoice(false);
    }
  };

  const handleStartVoiceChat = async () => {
    setAiError(null);
    setVoiceMode("chat");
    setVoiceChatMessages([]);
    setVoiceChatLoading(true);

    try {
      const res = await fetch("/api/ai/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Hey, I want to set up my voice profile. Ask me some questions so you can learn how I write.",
            },
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error || "Failed to start voice chat.");
        return;
      }
      if (data.reply) {
        setVoiceChatMessages([{ role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      console.error("Error starting voice chat:", err);
      setAiError(err?.message || "An unexpected error occurred.");
    } finally {
      setVoiceChatLoading(false);
    }
  };

  const handleSendVoiceChat = async () => {
    if (!voiceChatInput.trim() || voiceChatLoading) return;

    setAiError(null);

    const newMessages = [
      ...voiceChatMessages,
      { role: "user", content: voiceChatInput.trim() },
    ];
    setVoiceChatMessages(newMessages);
    setVoiceChatInput("");
    setVoiceChatLoading(true);

    try {
      const res = await fetch("/api/ai/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Hey, I want to set up my voice profile. Ask me some questions so you can learn how I write.",
            },
            ...newMessages,
          ],
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error || "Failed to get reply.");
        return;
      }
      if (data.reply) {
        setVoiceChatMessages([
          ...newMessages,
          { role: "assistant", content: data.reply },
        ]);
      }
    } catch (err) {
      console.error("Error in voice chat:", err);
      setAiError(err?.message || "An unexpected error occurred.");
    } finally {
      setVoiceChatLoading(false);
    }
  };

  const handleFinalizeVoiceChat = async () => {
    setAiError(null);
    setFinalizingVoice(true);
    try {
      const res = await fetch("/api/ai/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Hey, I want to set up my voice profile. Ask me some questions so you can learn how I write.",
            },
            ...voiceChatMessages,
          ],
          finalize: true,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAiError(data?.error || "Failed to finalize voice profile.");
        return;
      }
      if (data.voice_profile) {
        setVoiceProfile(data.voice_profile);
        setVoiceMode(null);
        setVoiceChatMessages([]);
        if (data.voice_profile.suggested_response_length) {
          setResponseLength(data.voice_profile.suggested_response_length);
        }
        posthog.capture("voice_analyzed", {
          method: "chat",
          source: "onboarding",
        });
      }
    } catch (err) {
      console.error("Error finalizing voice:", err);
      setAiError(err?.message || "An unexpected error occurred.");
    } finally {
      setFinalizingVoice(false);
    }
  };

  const handleRevertVoice = async () => {
    const prev = voiceProfile?.previous_profile;
    if (!prev) return;

    setAiError(null);
    try {
      const { error: dbErr } = await supabase
        .from("users")
        .update({ voice_profile: { ...prev, previous_profile: null } })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      setVoiceProfile({ ...prev, previous_profile: null });
      if (prev.suggested_response_length) {
        setResponseLength(prev.suggested_response_length);
      }
      posthog.capture("voice_reverted", { source: "onboarding" });
    } catch (err) {
      console.error("Error reverting voice:", err);
      setAiError(err?.message || "Failed to revert voice profile.");
    }
  };

  const scriptReady = !!profile?.script_config?.greeting;
  const instagramConnected = !!(
    profile?.unipile_account_id || profile?.instagram_business_account_id
  );

  const handleGoLive = async (checked) => {
    if (checked && !scriptReady) return;
    setAiError(null);
    setActivating(true);
    setAiActive(checked);

    try {
      const { error: dbErr } = await supabase
        .from("users")
        .update({
          ai_mode: checked ? "active" : "handoff",
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      // Set cookie so middleware knows onboarding is done
      document.cookie =
        "onboarding_completed=true; path=/; max-age=31536000; samesite=lax";

      if (checked) {
        posthog.capture("ai_agent_activated");
      }
    } catch (err) {
      console.error("Error going live:", err);
      setAiActive(!checked);
      setAiError(err?.message || "Failed to update AI status.");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf9]">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Step 5 has its own header */}
      {step !== 5 && <OnboardingHeader currentStep={step} />}

      {step === 1 && (
        <Step1Connect
          instagramConnected={instagramConnected}
          onSkip={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2Script
          offer={offer}
          setOffer={setOffer}
          targetCustomer={targetCustomer}
          setTargetCustomer={setTargetCustomer}
          objections={objections}
          setObjections={setObjections}
          calendlyUrl={calendlyUrl}
          setCalendlyUrl={setCalendlyUrl}
          saving={saving}
          generating={generating}
          onSave={handleSaveScriptConfig}
          onGenerate={handleGenerateScript}
          onApplyPreset={handleApplyPreset}
          aiError={aiError}
          onDismissError={dismissError}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && (
        <Step3Voice
          voiceProfile={voiceProfile}
          voiceMode={voiceMode}
          setVoiceMode={setVoiceMode}
          sampleText={sampleText}
          setSampleText={setSampleText}
          analyzingVoice={analyzingVoice}
          onAnalyzeVoice={handleAnalyzeVoice}
          voiceChatMessages={voiceChatMessages}
          voiceChatInput={voiceChatInput}
          setVoiceChatInput={setVoiceChatInput}
          voiceChatLoading={voiceChatLoading}
          finalizingVoice={finalizingVoice}
          onStartVoiceChat={handleStartVoiceChat}
          onSendVoiceChat={handleSendVoiceChat}
          onFinalizeVoiceChat={handleFinalizeVoiceChat}
          sampleMessageCount={sampleMessageCount}
          tone={tone}
          setTone={setTone}
          traits={traits}
          setTraits={setTraits}
          responseLength={responseLength}
          setResponseLength={setResponseLength}
          aiError={aiError}
          onDismissError={dismissError}
          onRevertVoice={handleRevertVoice}
          onBack={() => setStep(2)}
          onNext={() => {
            setStep(4);
            posthog.capture("onboarding_step_completed", { step: 3 });
          }}
        />
      )}

      {step === 4 && (
        <Step4Preview
          profile={profile}
          greeting={greeting}
          setGreeting={setGreeting}
          qualifyingQuestions={qualifyingQuestions}
          setQualifyingQuestions={setQualifyingQuestions}
          interestResponse={interestResponse}
          setInterestResponse={setInterestResponse}
          objectionHandlers={objectionHandlers}
          setObjectionHandlers={setObjectionHandlers}
          bookingMessage={bookingMessage}
          setBookingMessage={setBookingMessage}
          notAFitMessage={notAFitMessage}
          setNotAFitMessage={setNotAFitMessage}
          humanInLoop={humanInLoop}
          setHumanInLoop={setHumanInLoop}
          generating={generating}
          saving={saving}
          onGenerate={handleGenerateScript}
          onSave={handleSaveGeneratedScript}
          aiError={aiError}
          onDismissError={dismissError}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && (
        <Step5GoLive
          profile={profile}
          aiActive={aiActive}
          activating={activating}
          scriptReady={scriptReady}
          instagramConnected={instagramConnected}
          onGoLive={handleGoLive}
          onGoToDashboard={() => router.push("/dashboard")}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}
