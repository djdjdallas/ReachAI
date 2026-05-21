"use client";

import { useMemo, useState } from "react";
import { Mic, Plus } from "lucide-react";
import { VOICE_ELIGIBLE_CLASSES, VOICE_INTENT_LABELS } from "@/lib/voice/intent-classes";
import VoiceUploader from "@/components/voice/VoiceUploader";
import VoiceSnippetCard from "@/components/voice/VoiceSnippetCard";

const CORAL = "#ff7e67";

// Short blurbs for the coverage strip. Keyed on VOICE_ELIGIBLE_CLASSES;
// the labels themselves come from VOICE_INTENT_LABELS so display strings
// stay in lockstep with the classifier.
const VOICE_INTENT_BLURBS = {
  warm_intent: "First-touch warm inbound",
  objection_price: "Cost / payment plan concerns",
  objection_time: "Not right now / scheduling",
  objection_trust: "Proof / testimonials / does it work",
  booking_cta: "Send the link / book the call",
  follow_up: "Mid-conversation default",
};

export const VOICE_INTENT_CLASSES = VOICE_ELIGIBLE_CLASSES.map((key) => ({
  key,
  label: VOICE_INTENT_LABELS[key] || key,
  blurb: VOICE_INTENT_BLURBS[key] || "",
}));

export default function VoiceRepliesClient({ initialSnippets, killSwitchActive }) {
  const [snippets, setSnippets] = useState(initialSnippets || []);
  const [showUploader, setShowUploader] = useState(false);

  const activeByClass = useMemo(() => {
    const map = {};
    for (const s of snippets) {
      if (s.is_active) map[s.intent_class] = s;
    }
    return map;
  }, [snippets]);

  const coverage = Object.keys(activeByClass).length;

  function handleCreated(newSnippet) {
    setSnippets((prev) => {
      const filtered = prev.map((s) =>
        s.intent_class === newSnippet.intent_class && s.id !== newSnippet.id
          ? { ...s, is_active: false }
          : s
      );
      return [newSnippet, ...filtered];
    });
    setShowUploader(false);
  }

  function handleToggled(updated) {
    setSnippets((prev) =>
      prev.map((s) => {
        if (s.id === updated.id) return updated;
        if (
          updated.is_active &&
          s.intent_class === updated.intent_class &&
          s.id !== updated.id
        ) {
          return { ...s, is_active: false };
        }
        return s;
      })
    );
  }

  function handleDeleted(deletedId) {
    setSnippets((prev) => prev.filter((s) => s.id !== deletedId));
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#fff5f2" }}
            >
              <Mic className="h-4 w-4" style={{ color: CORAL }} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Voice Replies</h1>
          </div>
          <p className="mt-2 text-stone-600 max-w-xl">
            Upload your own voice memos for each intent. When a lead&apos;s message
            matches one, the AI sends your voice instead of a text reply.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowUploader(true)}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: CORAL }}
        >
          <Plus className="h-4 w-4" />
          Add voice reply
        </button>
      </div>

      {killSwitchActive && (
        <div
          className="mt-6 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
        >
          Voice Replies are disabled on this account by an administrator. New
          uploads will be saved but the AI will not send them until the kill
          switch is lifted.
        </div>
      )}

      <div
        className="mt-8 rounded-[2rem] bg-white border border-stone-200 p-6"
        style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Coverage
          </h2>
          <span className="text-sm text-stone-600">
            {coverage} / {VOICE_INTENT_CLASSES.length} intents covered
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {VOICE_INTENT_CLASSES.map((c) => {
            const covered = !!activeByClass[c.key];
            return (
              <div
                key={c.key}
                className="rounded-2xl border border-stone-200 p-3"
                style={{
                  backgroundColor: covered ? "#fff5f2" : "#fafaf9",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-stone-900">
                    {c.label}
                  </div>
                  <div
                    className={`h-2 w-2 rounded-full ${
                      covered ? "bg-[#ff7e67]" : "bg-stone-300"
                    }`}
                  />
                </div>
                <div className="mt-1 text-xs text-stone-500">{c.blurb}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">
          Your snippets
        </h2>
        {snippets.length === 0 ? (
          <div
            className="rounded-[2rem] border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500"
          >
            No voice snippets yet. Add your first one to start replying with
            your voice.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {snippets.map((snippet) => (
              <VoiceSnippetCard
                key={snippet.id}
                snippet={snippet}
                onToggled={handleToggled}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>

      {showUploader && (
        <VoiceUploader
          onClose={() => setShowUploader(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
