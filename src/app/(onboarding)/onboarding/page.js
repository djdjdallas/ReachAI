"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  resolveOnboardingAiMode,
  autoImportPending,
  AUTO_IMPORT_WAIT_MS,
  mergeKeepingSaved,
  fillIfEmpty,
} from "@/lib/onboarding";
import posthog from "posthog-js";
import { normalizeBookingUrl } from "@/lib/booking-url";
import { openingLineDbErrorMessage } from "@/lib/opening-line";
import { Loader2, AlertCircle, X } from "lucide-react";

import OnboardingHeader from "./components/OnboardingHeader";
import Step1Connect from "./components/Step1Connect";
import Step2Script from "./components/Step2Script";
import Step3Voice from "./components/Step3Voice";
import Step4Preview from "./components/Step4Preview";
import Step5GoLive from "./components/Step5GoLive";
import { SUPPORT_EMAIL } from "@/lib/support";

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
  // Step 5 toggle INTENT. Starts ON: finishing onboarding arms the AI unless
  // the user explicitly turns it off. Re-synced from the saved ai_mode once
  // the profile loads, so an explicit earlier 'handoff' choice is preserved.
  // (It used to start OFF, which made the footer's primary button read
  // "Continue with Handoff Mode" and silently left new users' AI off.)
  // What the toggle SHOWS, and what finalize writes, is aiArmed below: the
  // intent only counts once a greeting exists (scriptReady).
  const [aiActive, setAiActive] = useState(true);
  const [activating, setActivating] = useState(false);

  // AI/API errors surfaced to the user
  const [aiError, setAiError] = useState(null);
  const dismissError = () => setAiError(null);

  // Instagram OAuth error from the callback redirect. The callback at
  // /api/auth/instagram/callback redirects with ?error=<code> on failure
  // (no_igba_id = personal account, invalid_state = CSRF/expired,
  // callback_failed = outer catch). Surface a friendly banner instead of
  // silently dropping the coach back on step 1.
  const [igConnectError, setIgConnectError] = useState(null);

  // Leads the webhook is holding because no opening line is saved
  // (greeting_not_configured). Someone who connects Instagram and stops
  // mid-onboarding has ai_mode 'active' (the column default) but no
  // greeting, so every lead is held. Middleware keeps them in onboarding,
  // where the dashboard's "Opening line needed" banner never shows, so the
  // count is surfaced here too.
  const [heldForGreeting, setHeldForGreeting] = useState(0);

  // Result of Step 2's Connect Calendly round trip (/api/auth/calendly
  // ?return=onboarding sends the coach back with ?calendly=...).
  const [calendlyNotice, setCalendlyNotice] = useState(null);
  const [connectingCalendly, setConnectingCalendly] = useState(false);

  useEffect(() => {
    if (!searchParams) return;
    const status = searchParams.get("calendly");
    if (!status) return;
    const warning = searchParams.get("warning");
    let notice;
    if (status === "connected" && !warning) {
      notice = { kind: "success", message: "Calendly connected. Your AI will share your booking link in DMs." };
    } else if (status === "connected" && warning === "calendly_plan_limit") {
      notice = {
        kind: "warning",
        message:
          "Calendly connected. Your Calendly plan doesn't send booking updates, so booked calls won't be marked automatically, but your AI will still share your link.",
      };
    } else if (status === "connected") {
      notice = {
        kind: "warning",
        message:
          "Calendly connected, but booking updates didn't set up. Your AI will still share your link. You can retry from Settings later.",
      };
    } else {
      notice = { kind: "error", message: "Couldn't connect Calendly. Try again, or paste your booking link instead." };
    }
    setCalendlyNotice(notice);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("calendly");
    params.delete("warning");
    params.delete("reason");
    const next = params.toString();
    router.replace(`/onboarding${next ? `?${next}` : ""}`, { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    if (!searchParams) return;
    const code = searchParams.get("error");
    if (!code) return;
    const map = {
      no_igba_id:
        "It looks like you connected a personal Instagram account. Clinchd needs an Instagram Business or Creator account to qualify DMs. Switch your Instagram to a Business or Creator account and try again. Help: https://help.instagram.com/502981923235522",
      invalid_state:
        "Your connection attempt expired. Please click Connect Instagram to try again.",
      callback_failed:
        `Instagram didn't return a successful response. Try reconnecting, or contact ${SUPPORT_EMAIL} if it keeps failing.`,
      auth_failed:
        "Authorization was denied. Click Connect Instagram to try again.",
      ig_switch_blocked:
        "That's a different Instagram account than the one already connected here. To switch accounts, finish setup first, then use Settings → Instagram Connection, or reconnect with the original account.",
      ig_already_connected:
        `This Instagram account is already connected to another Clinchd account. Disconnect it there first, or contact ${SUPPORT_EMAIL}.`,
      ig_save_failed:
        `Saving your Instagram connection failed. Try again, or contact ${SUPPORT_EMAIL} if it keeps failing.`,
    };
    const message =
      map[code] ||
      `Something went wrong connecting your Instagram account. Try again, or contact ${SUPPORT_EMAIL}.`;
    setIgConnectError({ code, message });
    // Strip the error param so a refresh doesn't re-show the banner.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    const next = params.toString();
    router.replace(`/onboarding${next ? `?${next}` : ""}`, { scroll: false });
  }, [searchParams, router]);

  // Post-OAuth Instagram auto-import (voice profile + offer, target
  // customer, objections, greeting). True while we wait for it in the
  // background; the page stays usable and shows a "personalizing" banner.
  const [autoImporting, setAutoImporting] = useState(false);

  // Persisted user preferences (Step 3 + Step 4 controls)
  const [tone, setTone] = useState("professional");
  const [traits, setTraits] = useState({
    emojis: true,
    questions: true,
    stories: false,
    humor: false,
  });
  const [responseLength, setResponseLength] = useState("medium");
  const [scriptMode, setScriptMode] = useState("guided");
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
    let cancelled = false;

    function applyProfile(userProfile) {
      if (!userProfile) return;
      setProfile(userProfile);
      hydrateFromProfile(userProfile);
    }

    function hydrateFromProfile(userProfile) {
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

        if (config.script_mode) setScriptMode(config.script_mode);
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
    }

    // Imported values only fill fields that are still empty in the form.
    function applyImported(refreshed) {
      setProfile(refreshed);
      const sc = refreshed.script_config || {};
      setOffer((prev) => fillIfEmpty(prev, sc.offer));
      setTargetCustomer((prev) => fillIfEmpty(prev, sc.targetCustomer));
      setObjections((prev) => fillIfEmpty(prev, sc.objections));
      setGreeting((prev) => fillIfEmpty(prev, sc.greeting));
      if (refreshed.voice_profile?.status === "ready") {
        setVoiceProfile((prev) => prev ?? refreshed.voice_profile);
      }
    }

    async function waitForAutoImport(userId) {
      const start = Date.now();
      let latest = null;
      while (!cancelled && Date.now() - start < AUTO_IMPORT_WAIT_MS) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        const { data: refreshed } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .single();
        if (refreshed) {
          latest = refreshed;
          if (!autoImportPending(refreshed)) break;
        }
      }
      if (cancelled) return;
      if (latest) applyImported(latest);
      setAutoImporting(false);
    }

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
        if (
          userProfile.instagram_business_account_id &&
          !userProfile.script_config?.greeting
        ) {
          const { count: heldCount } = await supabase
            .from("conversations")
            .select("id", { count: "exact", head: true })
            .eq("user_id", authUser.id)
            .eq("last_skip_reason", "greeting_not_configured");
          if (!cancelled) setHeldForGreeting(heldCount || 0);
        }

        // Every step after 1 needs a connected Instagram account. ?step= is
        // read straight from the URL in the initial state, so a deep link
        // (or a disconnect after onboarding) could skip the Connect step.
        // The page renders a loader until init finishes, so correcting the
        // step here never flashes a later step.
        const urlStep = parseInt(searchParams.get("step"), 10);
        if (!userProfile.instagram_business_account_id && urlStep > 1) {
          setStep(1);
        }

        // Toggle mirrors the saved choice. A new user has the column default
        // ('active'); someone who switched to handoff keeps handoff.
        setAiActive(userProfile.ai_mode ? userProfile.ai_mode === "active" : true);

        // Auto-advance: if Instagram is connected and user is on step 1, go to step 2
        if (
          userProfile.instagram_business_account_id &&
          (!urlStep || urlStep <= 1)
        ) {
          setStep(2);
        }

        applyProfile(userProfile);

        // The post-connect import takes ~6.5s and may still be running.
        // Don't block the page on it: show onboarding now, wait in the
        // background, then fold the result into fields the coach hasn't
        // typed in. (It used to block on a spinner and stop at
        // attempted_at, which is stamped before the work starts, so the
        // imported fields never reached the form.)
        if (autoImportPending(userProfile)) {
          setAutoImporting(true);
          waitForAutoImport(authUser.id);
        }
      }

      if (!cancelled) setLoading(false);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Handlers ---

  // The stored script_config right now. Saves build on this, not on the
  // profile as loaded: the auto-import may have written fields since.
  const fetchLatestScriptConfig = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("script_config")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return data?.script_config || {};
  };

  const handleApplyPreset = ({ offer: o, targetCustomer: t, objections: obj }) => {
    setAiError(null);
    setOffer(o);
    setTargetCustomer(t);
    setObjections(obj);
  };

  // Step 2's save without advancing. Returns the saved script_config.
  const persistStep2 = async () => {
    // A blank form field never erases a saved value (mergeKeepingSaved).
    const scriptConfig = mergeKeepingSaved(await fetchLatestScriptConfig(), {
      greeting,
      qualifying_questions: qualifyingQuestions,
      interest_response: interestResponse,
      objection_handlers: objectionHandlers,
      booking_message: bookingMessage,
      not_a_fit_message: notAFitMessage,
      offer,
      targetCustomer,
      objections,
      tone,
      traits,
      response_length: responseLength,
      script_mode: scriptMode,
      human_in_loop: humanInLoop,
    });

    const booking = normalizeBookingUrl(calendlyUrl);
    if (!booking.ok) throw new Error(booking.error);

    const { error: dbErr } = await supabase
      .from("users")
      .update({
        script_config: scriptConfig,
        calendly_url: booking.value,
      })
      .eq("id", user.id);
    if (dbErr) throw new Error(openingLineDbErrorMessage(dbErr) || dbErr.message);

    setProfile((prev) => ({
      ...prev,
      script_config: scriptConfig,
      calendly_url: booking.value,
    }));
    return scriptConfig;
  };

  const handleSaveScriptConfig = async () => {
    setAiError(null);
    setSaving(true);
    try {
      await persistStep2();
      setStep(3);
      posthog.capture("onboarding_step_completed", { step: 2 });
    } catch (err) {
      console.error("Error saving script config:", err);
      setAiError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Connect Calendly from Step 2. Saves what's typed first: the OAuth round
  // trip reloads the page, which would otherwise drop the form.
  const handleConnectCalendly = async () => {
    setAiError(null);
    setConnectingCalendly(true);
    try {
      await persistStep2();
      window.location.href = "/api/auth/calendly?return=onboarding";
    } catch (err) {
      console.error("Error saving before Calendly connect:", err);
      setAiError(err?.message || "Couldn't save your answers. Try again.");
      setConnectingCalendly(false);
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
      const scriptConfig = mergeKeepingSaved(await fetchLatestScriptConfig(), {
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
        script_mode: scriptMode,
        human_in_loop: humanInLoop,
      });

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
  // The toggle as shown: ON only when the user wants it AND a greeting
  // exists, so a user with no script sees it OFF and can't finish with
  // ai_mode='active' while the webhook silently skips every reply.
  const aiArmed = aiActive && scriptReady;
  const instagramConnected = !!profile?.instagram_business_account_id;

  // Step 3 — persist voice prefs (tone/traits/response_length) and advance.
  // voice_profile itself is already written by /api/ai/analyze-voice and
  // /api/ai/voice-chat at the time it was analyzed, so we don't re-write it
  // here; we just save the explicit tone/trait controls and move on.
  const handleSaveVoiceAndAdvance = async () => {
    setAiError(null);
    setSaving(true);
    try {
      const scriptConfig = mergeKeepingSaved(await fetchLatestScriptConfig(), {
        tone,
        traits,
        response_length: responseLength,
      });

      const { error: dbErr } = await supabase
        .from("users")
        .update({ script_config: scriptConfig })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      setProfile((prev) => ({ ...prev, script_config: scriptConfig }));
      setStep(4);
      posthog.capture("onboarding_step_completed", { step: 3 });
    } catch (err) {
      console.error("Error saving voice prefs:", err);
      setAiError(err?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Step 3 — Skip path. Advance without writing anything.
  const handleSkipVoice = () => {
    setStep(4);
    posthog.capture("onboarding_step_completed", { step: 3, skipped: true });
  };

  // Step 5 — finalize onboarding and route to dashboard. ai_mode is read from
  // the in-page toggle: ON → active (the default), OFF → handoff (only when
  // the user turned it off). { activate } overrides the toggle; either way
  // 'active' also needs scriptReady (resolveOnboardingAiMode). Every dashboard-bound exit from step 5 MUST go
  // through here: a bare router.push("/dashboard") leaves
  // onboarding_completed false and middleware bounces the user straight back
  // to step 2.
  const handleFinalizeAndGo = async ({ activate } = {}) => {
    const goLive =
      resolveOnboardingAiMode({
        wantsActive: activate === undefined ? aiActive : activate,
        scriptReady,
      }) === "active";
    setAiError(null);
    setActivating(true);
    try {
      const { error: dbErr } = await supabase
        .from("users")
        .update({
          ai_mode: goLive ? "active" : "handoff",
          onboarding_completed: true,
        })
        .eq("id", user.id);
      if (dbErr) throw dbErr;

      document.cookie =
        "onboarding_completed=true; path=/; max-age=31536000; samesite=lax";

      if (goLive) posthog.capture("ai_agent_activated");
      router.push("/dashboard");
    } catch (err) {
      console.error("Error finalizing onboarding:", err);
      setAiError(err?.message || "Failed to complete onboarding.");
    } finally {
      setActivating(false);
    }
  };

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

      {igConnectError && step === 1 && (
        <div className="px-4 pt-4">
          <div className="max-w-5xl mx-auto flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p className="flex-1 leading-relaxed">{igConnectError.message}</p>
            <button
              type="button"
              onClick={() => setIgConnectError(null)}
              aria-label="Dismiss"
              className="rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {heldForGreeting > 0 && !scriptReady && step !== 4 && (
        <div className="px-4 pt-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
            <p className="flex-1 leading-relaxed">
              <span className="font-bold">
                {heldForGreeting === 1
                  ? "1 lead is waiting for a reply."
                  : `${heldForGreeting} leads are waiting for a reply.`}
              </span>{" "}
              Your AI can&apos;t answer anyone until you save an opening line.
              It takes about a minute.
            </p>
            <button
              type="button"
              onClick={() => setStep(offer && targetCustomer ? 4 : 2)}
              className="shrink-0 rounded-full bg-[#ff7e67] px-4 py-2 text-xs font-bold text-white hover:bg-[#ff6a50]"
            >
              Finish setup
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <Step1Connect
          instagramConnected={instagramConnected}
          onNext={() => setStep(2)}
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
          calendlyConnected={!!profile?.calendly_user_uri}
          connectingCalendly={connectingCalendly}
          onConnectCalendly={handleConnectCalendly}
          calendlyNotice={calendlyNotice}
          onDismissCalendlyNotice={() => setCalendlyNotice(null)}
          saving={saving}
          generating={generating}
          onSave={handleSaveScriptConfig}
          onGenerate={handleGenerateScript}
          onApplyPreset={handleApplyPreset}
          aiError={aiError}
          onDismissError={dismissError}
          onBack={() => setStep(1)}
          autoImporting={autoImporting}
          autoImportedSource={
            profile?.voice_profile?.source === "instagram_auto"
              ? "instagram_auto"
              : null
          }
        />
      )}

      {step === 3 && (
        <Step3Voice
          voiceProfile={voiceProfile}
          autoImporting={autoImporting}
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
          saving={saving}
          onSaveAndAdvance={handleSaveVoiceAndAdvance}
          onSkip={handleSkipVoice}
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
          scriptMode={scriptMode}
          setScriptMode={setScriptMode}
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
          aiActive={aiArmed}
          activating={activating}
          scriptReady={scriptReady}
          instagramConnected={instagramConnected}
          onGoLive={handleGoLive}
          // Both finish buttons follow the toggle; onboarding is persisted
          // as complete before navigating.
          onFinalize={() => handleFinalizeAndGo()}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}
