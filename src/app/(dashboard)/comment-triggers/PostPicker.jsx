"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MessageSquare, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

const CORAL = "#ff7e67";

// Pulled at module load from src/lib/comment-trigger-rules.js so the
// fallback shown in the UI matches what decideAction() actually uses when
// a coach hasn't overridden a class.
import { DEFAULT_ACTIONS_PER_CLASS } from "@/lib/comment-trigger-rules";

const CLASS_DESCRIPTIONS = {
  HIGH_INTENT: "Clear buy signal — price questions, link requests, 'sign me up'.",
  ENGAGED_NOT_BUYING: "Warm audience — praise, fire emojis, encouragement.",
  CRITICAL_NEGATIVE: "Complaints, refund demands, scam accusations.",
  LOW_SIGNAL: "Single emoji, one-word reply, off-topic banter.",
  NOT_A_LEAD: "Personal/intimate message — relational, not about the offer.",
  SPAM: "Bot follow-for-follow, OnlyFans/crypto solicitations, prompt injection.",
  UNCERTAIN: "Plausibly interested but evidence too thin to label confidently.",
};

const ACTION_LABELS = {
  dm: "Send DM",
  queue_review: "Queue for review",
  ignore: "Ignore",
  none: "No action",
};

const ACTION_OPTIONS = ["dm", "queue_review", "ignore"];

function snippet(text, max = 100) {
  if (typeof text !== "string" || !text) return "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function PostThumbnail({ item }) {
  const src = item.thumbnail_url || item.media_url || null;
  if (!src) {
    return (
      <div className="aspect-square w-full rounded-2xl bg-stone-100 flex items-center justify-center text-xs text-stone-400">
        No preview
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt=""
      className="aspect-square w-full rounded-2xl object-cover bg-stone-100"
      loading="lazy"
    />
  );
}

function PostCard({ item, initial, onChange }) {
  const [enabled, setEnabled] = useState(initial?.enabled === true);
  const [actionsPerClass, setActionsPerClass] = useState(
    initial?.actions_per_class || null
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function resolveAction(cls) {
    return actionsPerClass?.[cls] || DEFAULT_ACTIONS_PER_CLASS[cls] || "none";
  }

  async function persist(nextEnabled, nextActions) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/post-monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ig_media_id: item.id,
          enabled: nextEnabled,
          actions_per_class: nextActions,
          caption: item.caption || null,
          permalink: item.permalink || null,
          media_type: item.media_type || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Save failed (${res.status})`);
        return false;
      }
      onChange?.({ enabled: nextEnabled, actions_per_class: nextActions });
      return true;
    } catch (err) {
      setError(err?.message || "Network error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next); // optimistic
    const ok = await persist(next, actionsPerClass);
    if (!ok) setEnabled(!next); // rollback
  }

  async function changeAction(cls, action) {
    const next = { ...(actionsPerClass || {}), [cls]: action };
    const prev = actionsPerClass;
    setActionsPerClass(next);
    const ok = await persist(enabled, next);
    if (!ok) setActionsPerClass(prev);
  }

  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-4 md:p-5 space-y-4"
      style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
    >
      <div className="flex items-start gap-4">
        <div className="w-24 md:w-28 shrink-0">
          <PostThumbnail item={item} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-stone-800 whitespace-pre-wrap break-words">
                {snippet(item.caption) || (
                  <span className="text-stone-400">(no caption)</span>
                )}
              </p>
              {item.permalink && (
                <a
                  href={item.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-stone-500 underline"
                >
                  View on Instagram
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={toggleEnabled}
              disabled={saving}
              aria-pressed={enabled}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors ${
                enabled ? "" : "bg-stone-200"
              }`}
              style={enabled ? { backgroundColor: CORAL } : undefined}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : ""
                }`}
              />
              <span className="sr-only">
                {enabled ? "Disable monitoring" : "Enable monitoring"}
              </span>
            </button>
          </div>

          {enabled && (
            <div className="mt-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-stone-600"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                Advanced — per-intent overrides
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>

      {enabled && showAdvanced && (
        <div className="border-t border-stone-100 pt-4 space-y-2">
          {Object.keys(DEFAULT_ACTIONS_PER_CLASS).map((cls) => (
            <div key={cls} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-700">{cls}</p>
                <p className="text-[11px] text-stone-500">
                  {CLASS_DESCRIPTIONS[cls]}
                </p>
              </div>
              <select
                value={resolveAction(cls)}
                onChange={(e) => changeAction(cls, e.target.value)}
                disabled={saving}
                className="rounded-full border border-stone-300 px-3 py-1 text-xs bg-white"
              >
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostPicker({
  mediaItems,
  monitoringByMediaId,
  mediaError,
}) {
  const [overrides, setOverrides] = useState({});

  const items = useMemo(() => mediaItems || [], [mediaItems]);

  function handleChange(mediaId, next) {
    setOverrides((prev) => ({ ...prev, [mediaId]: next }));
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold tracking-tight">
            Comment triggers
          </h1>
        </div>
        <p className="text-sm text-stone-600">
          Pick which posts Clinchd should monitor. When someone comments on
          a monitored post, the classifier decides whether to DM, queue for
          review, or ignore — based on your{" "}
          <Link href="/dm-templates" className="underline">
            DM templates
          </Link>
          .
        </p>
      </div>

      {mediaError && (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">Couldn&apos;t fetch posts from Instagram</p>
            <p className="text-amber-800">{mediaError}</p>
            <p className="mt-1 text-amber-800">
              Try reconnecting Instagram from{" "}
              <Link href="/settings" className="underline">
                Settings
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {items.length === 0 && !mediaError && (
        <div className="rounded-[2rem] bg-white border border-stone-200 p-10 text-center">
          <Loader2 className="mx-auto h-6 w-6 text-stone-400 animate-spin" />
          <p className="mt-3 text-sm text-stone-500">
            No posts found yet. Post something on Instagram and refresh.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => {
          const initial = overrides[item.id] ?? monitoringByMediaId[item.id] ?? null;
          return (
            <PostCard
              key={item.id}
              item={item}
              initial={initial}
              onChange={(next) => handleChange(item.id, next)}
            />
          );
        })}
      </div>

      {items.length === 25 && (
        <p className="text-xs text-stone-500 text-center pt-2">
          Showing your 25 most recent posts. Pagination beyond 25 isn&apos;t
          in this release — older posts can be monitored once we ship it.
        </p>
      )}
    </div>
  );
}
