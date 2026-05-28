"use client";

import { useMemo, useState } from "react";
import { Send, Plus, Clock, Loader2, Pencil, Trash2, AlertCircle } from "lucide-react";
import { VOICE_ELIGIBLE_CLASSES, VOICE_INTENT_LABELS } from "@/lib/voice/intent-classes";
import DripTemplateEditor from "@/components/drip/DripTemplateEditor";

const CORAL = "#ff7e67";

// Short blurbs for the coverage strip. Keyed on the 6 nudge-eligible classes;
// labels come from VOICE_INTENT_LABELS so display strings stay in lockstep
// with the classifier.
const INTENT_BLURBS = {
  warm_intent: "First-touch warm inbound",
  objection_price: "Cost / payment plan concerns",
  objection_time: "Not right now / scheduling",
  objection_trust: "Proof / testimonials / does it work",
  booking_cta: "Send the link / book the call",
  follow_up: "Mid-conversation default",
};

const INTENT_CLASSES = VOICE_ELIGIBLE_CLASSES.map((key) => ({
  key,
  label: VOICE_INTENT_LABELS[key] || key,
  blurb: INTENT_BLURBS[key] || "",
}));

const DELAY_OPTIONS = [12, 15, 18, 21];

export default function DripSequencesClient({ initialSettings, initialTemplates }) {
  const [settings, setSettings] = useState(initialSettings);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [savingToggle, setSavingToggle] = useState(false);
  const [savingDelay, setSavingDelay] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  const activeByClass = useMemo(() => {
    const map = {};
    for (const t of templates) {
      if (t.is_active) map[t.intent_class] = t;
    }
    return map;
  }, [templates]);

  const coverage = Object.keys(activeByClass).length;

  async function patchSettings(update, setSaving) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/drip-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update settings.");
        return false;
      }
      setSettings({
        drip_enabled: data.drip_enabled,
        drip_delay_hours: data.drip_delay_hours,
      });
      return true;
    } catch (err) {
      setError(err.message || "Network error.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function handleToggle() {
    patchSettings({ drip_enabled: !settings.drip_enabled }, setSavingToggle);
  }

  function handleDelay(hours) {
    patchSettings({ drip_delay_hours: hours }, setSavingDelay);
  }

  function handleSaved(saved) {
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === saved.id);
      const base = exists
        ? prev.map((t) => (t.id === saved.id ? saved : t))
        : [saved, ...prev];
      // Reflect the "one active per class" rule locally.
      if (saved.is_active) {
        return base.map((t) =>
          t.intent_class === saved.intent_class && t.id !== saved.id
            ? { ...t, is_active: false }
            : t
        );
      }
      return base;
    });
    setEditorOpen(false);
    setEditing(null);
  }

  async function handleToggleActive(template) {
    try {
      const res = await fetch(`/api/drip-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !template.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update.");
        return;
      }
      handleSaved(data.template);
    } catch (err) {
      setError(err.message || "Network error.");
    }
  }

  async function handleDelete(template) {
    try {
      const res = await fetch(`/api/drip-templates/${template.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete.");
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err) {
      setError(err.message || "Network error.");
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10">
      {/* Deploy-dark preview banner (TEMPORARY — remove once comment-to-DM
          Meta App Review completes). */}
      <div className="mb-6 rounded-[1.5rem] border border-[#ff7e67]/30 bg-[#fff5f2] px-5 py-4 text-sm text-stone-700">
        <span className="font-semibold">Follow-up nudges are in preview.</span>{" "}
        Comment-to-DM Meta App Review must complete before this feature is
        publicly available.
      </div>

      {/* Header + master toggle */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#fff5f2" }}
            >
              <Send className="h-4 w-4" style={{ color: CORAL }} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Follow-up Nudges</h1>
          </div>
          <p className="mt-2 text-stone-600 max-w-xl">
            Send a personal follow-up if your lead goes quiet before
            Instagram&apos;s 24-hour window closes. One nudge per conversation,
            routed by intent.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: CORAL }}
        >
          <Plus className="h-4 w-4" />
          Add follow-up nudge
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Master toggle card */}
      <div
        className="mt-8 rounded-[2rem] bg-white border border-stone-200 p-6 flex items-center justify-between gap-4"
        style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
      >
        <div>
          <div className="text-base font-semibold text-stone-900">
            Enable follow-up nudges
          </div>
          <div className="mt-1 text-sm text-stone-500">
            When off, no nudges are scheduled or sent for any conversation.
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.drip_enabled}
          onClick={handleToggle}
          disabled={savingToggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
            settings.drip_enabled ? "bg-[#ff7e67]" : "bg-stone-300"
          } ${savingToggle ? "opacity-60" : ""}`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              settings.drip_enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Delay configuration */}
      <div
        className="mt-6 rounded-[2rem] bg-white border border-stone-200 p-6"
        style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900">
          <Clock className="h-4 w-4 text-stone-400" />
          Send nudge after silence
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {DELAY_OPTIONS.map((hours) => {
            const selected = settings.drip_delay_hours === hours;
            return (
              <button
                key={hours}
                type="button"
                onClick={() => handleDelay(hours)}
                disabled={savingDelay}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selected
                    ? "bg-[#ff7e67] text-white shadow-sm shadow-[#ff7e67]/25"
                    : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
              >
                {hours}h
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-stone-500">
          Nudges fire within Instagram&apos;s 24-hour messaging window. Higher
          delays give the lead more time to reply naturally.
        </p>
      </div>

      {/* Coverage strip */}
      <div
        className="mt-6 rounded-[2rem] bg-white border border-stone-200 p-6"
        style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Coverage
          </h2>
          <span className="text-sm text-stone-600">
            {coverage} / {INTENT_CLASSES.length} intents covered
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTENT_CLASSES.map((c) => {
            const covered = !!activeByClass[c.key];
            return (
              <div
                key={c.key}
                className="rounded-2xl border border-stone-200 p-3"
                style={{ backgroundColor: covered ? "#fff5f2" : "#fafaf9" }}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-stone-900">{c.label}</div>
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

      {/* Template list */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500 mb-3">
          Your follow-ups
        </h2>
        {templates.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-stone-300 bg-white p-10 text-center text-stone-500">
            No follow-ups yet. Add your first nudge to start nurturing quiet
            leads.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((t) => (
              <div
                key={t.id}
                className="rounded-[1.5rem] bg-white border border-stone-200 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-stone-900">
                      {t.label}
                    </div>
                    <div className="mt-0.5 text-xs text-stone-500">
                      {VOICE_INTENT_LABELS[t.intent_class] || t.intent_class}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      t.is_active
                        ? "bg-[#fff5f2] text-[#ff7e67]"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {t.is_active ? "Active" : "Off"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-stone-600 leading-relaxed line-clamp-3">
                  {t.content}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-stone-400">
                    Sent {t.send_count || 0}×
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(t)}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium text-stone-500 hover:bg-stone-100"
                    >
                      {t.is_active ? "Turn off" : "Turn on"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(t);
                        setEditorOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                      aria-label="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editorOpen && (
        <DripTemplateEditor
          template={editing}
          existingActiveClasses={Object.keys(activeByClass)}
          onClose={() => {
            setEditorOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
