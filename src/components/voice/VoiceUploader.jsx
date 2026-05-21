"use client";

import { useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { VOICE_ELIGIBLE_CLASSES, VOICE_INTENT_LABELS } from "@/lib/voice/intent-classes";

const CORAL = "#ff7e67";

const VOICE_INTENT_OPTIONS = VOICE_ELIGIBLE_CLASSES.map((key) => ({
  key,
  label: VOICE_INTENT_LABELS[key] || key,
}));

const EXTENSION_TO_MIME = {
  mp3: "audio/mpeg",
  m4a: "audio/x-m4a",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DURATION_MS = 90_000;

function getExtension(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

async function readDurationMs(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement("audio");
    let settled = false;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      URL.revokeObjectURL(url);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("metadata_timeout"));
    }, 5000);

    audio.preload = "metadata";
    audio.src = url;
    audio.onloadedmetadata = () => {
      if (settled) return;
      settled = true;
      const seconds = audio.duration;
      cleanup();
      if (!Number.isFinite(seconds)) {
        reject(new Error("malformed_audio"));
        return;
      }
      resolve(Math.round(seconds * 1000));
    };
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("audio_load_failed"));
    };
  });
}

export default function VoiceUploader({ onClose, onCreated }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [durationMs, setDurationMs] = useState(0);
  const [intentClass, setIntentClass] = useState("");
  const [label, setLabel] = useState("");
  const [transcript, setTranscript] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleFileChange(e) {
    setError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = getExtension(f.name);
    if (!EXTENSION_TO_MIME[ext]) {
      setError("Unsupported file type. Use mp3, m4a, wav, or ogg.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("File too large. Max 5 MB.");
      return;
    }
    let ms;
    try {
      ms = await readDurationMs(f);
    } catch {
      setError("Couldn't read this audio file. Try re-exporting as mp3 or m4a.");
      return;
    }
    if (ms <= 0 || ms > MAX_DURATION_MS) {
      setError("Audio must be between 1 and 90 seconds.");
      return;
    }
    setFile(f);
    setDurationMs(ms);
  }

  const canSubmit =
    file && intentClass && label.trim() && consent && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const ext = getExtension(file.name);

      const urlRes = await fetch("/api/voice-snippets/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extension: ext }),
      });
      if (!urlRes.ok) {
        const detail = await urlRes.json().catch(() => ({}));
        throw new Error(detail?.error || "Failed to get upload URL");
      }
      const { storagePath, signedUrl } = await urlRes.json();

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": EXTENSION_TO_MIME[ext] },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error("Upload to storage failed");
      }

      const createRes = await fetch("/api/voice-snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intentClass,
          label: label.trim(),
          storagePath,
          durationMs,
          mimeType: EXTENSION_TO_MIME[ext],
          fileSizeBytes: file.size,
          transcript: transcript.trim() || undefined,
          consentConfirmed: true,
        }),
      });
      if (!createRes.ok) {
        const detail = await createRes.json().catch(() => ({}));
        throw new Error(detail?.error || "Failed to save snippet");
      }
      const { snippet } = await createRes.json();
      onCreated?.(snippet);
    } catch (err) {
      setError(err?.message || "Upload failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-lg rounded-[2rem] bg-white border border-stone-200 p-6 md:p-8"
        style={{ boxShadow: "0 12px 40px rgba(15,15,15,0.18)" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Add voice reply</h2>
            <p className="mt-1 text-sm text-stone-600">
              Upload one of your own voice memos. The AI will send it when an
              inbound DM matches the intent.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-stone-500 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-stone-700">Audio file</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/x-m4a"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-stone-700 file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:bg-stone-100 file:text-stone-700 file:font-medium hover:file:bg-stone-200"
            />
            {file && (
              <div className="mt-1 text-xs text-stone-500">
                {file.name} · {(file.size / 1024).toFixed(0)} KB ·{" "}
                {(durationMs / 1000).toFixed(1)}s
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">Intent</label>
            <select
              value={intentClass}
              onChange={(e) => setIntentClass(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">Choose an intent…</option>
              {VOICE_INTENT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">Label</label>
            <input
              type="text"
              value={label}
              maxLength={80}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Friendly intro for warm leads"
              className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">
              Transcript (optional)
            </label>
            <textarea
              value={transcript}
              maxLength={2000}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste what you say in this voice memo — helps your team review later."
              rows={3}
              className="mt-1 block w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-start gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1"
            />
            <span>
              I confirm this is my own voice. I will not upload AI-generated,
              cloned, or impersonated audio.
            </span>
          </label>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: CORAL }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {submitting ? "Uploading…" : "Save voice reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
