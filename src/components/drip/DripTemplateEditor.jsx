"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { VOICE_ELIGIBLE_CLASSES, VOICE_INTENT_LABELS } from "@/lib/voice/intent-classes";

const CORAL = "#ff7e67";
const MIN_CONTENT = 10;
const MAX_CONTENT = 1000;
const MAX_LABEL = 80;

// Create / edit a follow-up nudge template. Text-only (no audio, so no consent
// checkbox). On create the coach picks an intent class; on edit the class is
// fixed (it's the key the nudge routes on) and only label/content change.
export default function DripTemplateEditor({
  template,
  existingActiveClasses = [],
  onClose,
  onSaved,
}) {
  const isEdit = !!template;
  const [intentClass, setIntentClass] = useState(
    template?.intent_class || VOICE_ELIGIBLE_CLASSES[0]
  );
  const [label, setLabel] = useState(template?.label || "");
  const [content, setContent] = useState(template?.content || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const contentLen = content.trim().length;
  const contentValid = contentLen >= MIN_CONTENT && contentLen <= MAX_CONTENT;
  const labelValid = label.trim().length > 0 && label.trim().length <= MAX_LABEL;
  const canSave = contentValid && labelValid && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/drip-templates/${template.id}` : "/api/drip-templates";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { label: label.trim(), content: content.trim() }
        : { intentClass, label: label.trim(), content: content.trim() };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to save follow-up.");
        return;
      }
      onSaved(data.template);
    } catch (err) {
      setError(err.message || "Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 md:p-8 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold tracking-tight">
            {isEdit ? "Edit follow-up" : "New follow-up nudge"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {/* Intent class */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">When the lead is…</label>
            <select
              value={intentClass}
              onChange={(e) => setIntentClass(e.target.value)}
              disabled={isEdit}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67] disabled:opacity-60"
            >
              {VOICE_ELIGIBLE_CLASSES.map((cls) => {
                const covered = existingActiveClasses.includes(cls) && cls !== template?.intent_class;
                return (
                  <option key={cls} value={cls}>
                    {VOICE_INTENT_LABELS[cls] || cls}
                    {covered ? " (has active nudge)" : ""}
                  </option>
                );
              })}
            </select>
            {isEdit && (
              <p className="text-[11px] text-stone-400">
                Intent is fixed for an existing nudge. Delete and recreate to
                change it.
              </p>
            )}
          </div>

          {/* Label */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-stone-600">Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={MAX_LABEL}
              placeholder="e.g. Gentle price nudge"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67]"
            />
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-600">Message</label>
              <span
                className={`text-[11px] ${
                  contentValid || contentLen === 0 ? "text-stone-400" : "text-red-500"
                }`}
              >
                {contentLen}/{MAX_CONTENT}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="hey just wanted to check if you saw my last message — happy to chat whenever works."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7e67]/20 focus:border-[#ff7e67] resize-none"
            />
            <p className="text-[11px] text-stone-400 leading-relaxed">
              Write this as a gentle nudge, not a sales pitch. Example: &quot;hey
              just wanted to check if you saw my last message — happy to chat
              whenever works.&quot;
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: CORAL }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save changes" : "Add follow-up"}
          </button>
        </div>
      </div>
    </div>
  );
}
