"use client";

import { useRef, useState } from "react";
import { Play, Pause, Trash2, Loader2 } from "lucide-react";

const CORAL = "#ff7e67";

const INTENT_LABELS = {
  warm_intent: "Warm intent",
  objection_price: "Price objection",
  objection_time: "Timing objection",
  objection_trust: "Trust objection",
  booking_cta: "Booking moment",
  follow_up: "Follow-up",
};

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function VoiceSnippetCard({ snippet, onToggled, onDeleted }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loadingPlayback, setLoadingPlayback] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  async function ensureSrc() {
    if (audioRef.current?.src) return;
    setLoadingPlayback(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice-snippets/${snippet.id}/playback-url`);
      if (!res.ok) throw new Error("Could not load audio");
      const { url } = await res.json();
      if (audioRef.current) {
        audioRef.current.src = url;
      }
    } catch (err) {
      setError(err?.message || "Playback failed");
    } finally {
      setLoadingPlayback(false);
    }
  }

  async function handlePlayToggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    await ensureSrc();
    if (audioRef.current.src) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch {
        setError("Browser blocked playback");
      }
    }
  }

  async function handleToggleActive() {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice-snippets/${snippet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !snippet.is_active }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error || "Toggle failed");
      }
      const { snippet: updated } = await res.json();
      onToggled?.(updated);
    } catch (err) {
      setError(err?.message || "Toggle failed");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Delete the voice snippet "${snippet.label}"? This cannot be undone.`
      );
      if (!confirmed) return;
    }
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice-snippets/${snippet.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.error || "Delete failed");
      }
      onDeleted?.(snippet.id);
    } catch (err) {
      setError(err?.message || "Delete failed");
      setWorking(false);
    }
  }

  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-5"
      style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-stone-500">
            {INTENT_LABELS[snippet.intent_class] || snippet.intent_class}
          </div>
          <div className="mt-1 text-base font-semibold text-stone-900">
            {snippet.label}
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {formatDuration(snippet.duration_ms)} · sent{" "}
            {snippet.send_count || 0} {snippet.send_count === 1 ? "time" : "times"}
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            snippet.is_active
              ? "bg-[#fff5f2] text-[#ff7e67]"
              : "bg-stone-100 text-stone-500"
          }`}
        >
          {snippet.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      {snippet.transcript && (
        <p className="mt-3 text-sm text-stone-600 italic line-clamp-3">
          &ldquo;{snippet.transcript}&rdquo;
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handlePlayToggle}
          className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-50"
        >
          {loadingPlayback ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {playing ? "Pause" : "Preview"}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={handleToggleActive}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{
            backgroundColor: snippet.is_active ? "#1c1917" : CORAL,
          }}
        >
          {snippet.is_active ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          disabled={working}
          onClick={handleDelete}
          className="ml-auto inline-flex items-center gap-1 rounded-full p-2 text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          aria-label="Delete snippet"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        className="hidden"
      />
    </div>
  );
}
