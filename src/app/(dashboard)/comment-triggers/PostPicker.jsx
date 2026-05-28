"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

const CORAL = "#ff7e67";
const AMBER = "#f59e0b";

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

function snippet(text, max = 240) {
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

// Build a short, human-readable summary of the per-intent overrides for the
// collapsed Advanced section. Helps coaches see current state at a glance.
function summarizeOverrides(actionsPerClass) {
  const effective = { ...DEFAULT_ACTIONS_PER_CLASS, ...(actionsPerClass || {}) };
  const dmClasses = Object.keys(effective).filter(
    (cls) => effective[cls] === "dm"
  );

  const isDefault =
    !actionsPerClass ||
    Object.keys(actionsPerClass).every(
      (cls) => actionsPerClass[cls] === DEFAULT_ACTIONS_PER_CLASS[cls]
    );

  if (isDefault) return "Using default behavior (recommended).";
  if (dmClasses.length === 0) return "No classes will send DMs from this post.";
  if (dmClasses.length === 1) {
    return `Currently sending DMs on ${dmClasses[0]} only.`;
  }
  if (dmClasses.length === 2) {
    return `Currently sending DMs on ${dmClasses[0]} and ${dmClasses[1]}.`;
  }
  const head = dmClasses.slice(0, -1).join(", ");
  const tail = dmClasses[dmClasses.length - 1];
  return `Currently sending DMs on ${head}, and ${tail}.`;
}

function PostCard({ item, initial, templatesByClass, onChange }) {
  const [enabled, setEnabled] = useState(initial?.enabled === true);
  const [actionsPerClass, setActionsPerClass] = useState(
    initial?.actions_per_class || null
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resetToast, setResetToast] = useState(false);

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

  async function resetOverrides() {
    const prev = actionsPerClass;
    setActionsPerClass(null);
    // sanitizeActionsPerClass in the route returns null for null input,
    // which clears the column.
    const ok = await persist(enabled, null);
    if (!ok) {
      setActionsPerClass(prev);
      return;
    }
    setResetToast(true);
  }

  // Auto-dismiss the reset confirmation after 3s.
  useEffect(() => {
    if (!resetToast) return;
    const t = setTimeout(() => setResetToast(false), 3000);
    return () => clearTimeout(t);
  }, [resetToast]);

  const hasOverrides = actionsPerClass && Object.keys(actionsPerClass).length > 0;

  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-4 md:p-5 space-y-4"
      style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
    >
      <div className="flex items-start gap-4">
        <div className="w-28 md:w-32 shrink-0">
          <PostThumbnail item={item} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-stone-800 break-words line-clamp-2">
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
                {enabled ? "Stop watching post" : "Start watching post"}
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
              {!showAdvanced && (
                <p className="mt-1 text-xs text-stone-500">
                  {summarizeOverrides(actionsPerClass)}
                </p>
              )}
            </div>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      </div>

      {enabled && showAdvanced && (
        <div className="border-t border-stone-100 pt-4 space-y-3">
          {Object.keys(DEFAULT_ACTIONS_PER_CLASS).map((cls) => {
            const action = resolveAction(cls);
            const templateMissing =
              action === "dm" && templatesByClass?.[cls] !== true;
            return (
              <div key={cls} className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-700">{cls}</p>
                    <p className="text-[11px] text-stone-500">
                      {CLASS_DESCRIPTIONS[cls]}
                    </p>
                  </div>
                  <select
                    value={action}
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
                {templateMissing && (
                  <p
                    className="text-[11px] inline-flex items-center gap-1"
                    style={{ color: AMBER }}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    <span>
                      No template written —{" "}
                      <Link href="/dm-templates" className="underline">
                        write one in DM Templates →
                      </Link>
                    </span>
                  </p>
                )}
              </div>
            );
          })}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={resetOverrides}
              disabled={saving || !hasOverrides}
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              <RotateCcw className="h-3 w-3" />
              Reset overrides to defaults
            </button>
            {resetToast && (
              <span className="text-xs text-stone-500">
                Overrides reset to defaults.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Empty state shown while the IG /me/media response is still null. Holds a
// spinner for 5 seconds before swapping to a reconnect prompt — most
// "no posts" cases are stale tokens, not literally-empty accounts.
function NoPostsEmptyState() {
  const [showReconnect, setShowReconnect] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowReconnect(true), 5000);
    return () => clearTimeout(t);
  }, []);

  if (!showReconnect) {
    return (
      <div className="rounded-[2rem] bg-white border border-stone-200 p-10 text-center">
        <Loader2 className="mx-auto h-6 w-6 text-stone-400 animate-spin" />
        <p className="mt-3 text-sm text-stone-500">
          Looking for your Instagram posts…
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[2rem] bg-white border border-stone-200 p-10 text-center">
      <p className="text-sm text-stone-700 font-semibold">
        We couldn&apos;t find any recent posts on your connected Instagram
        account.
      </p>
      <p className="mt-2 text-sm text-stone-500 max-w-md mx-auto">
        This may take a moment after first connecting — try refreshing in a
        few seconds. If posts still don&apos;t appear, your account may need
        to be reconnected.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-stone-900 text-white px-4 py-2 text-xs font-semibold"
      >
        Reconnect Instagram →
      </Link>
    </div>
  );
}

export default function PostPicker({
  mediaItems,
  monitoringByMediaId,
  mediaError,
  templatesByClass,
}) {
  const [overrides, setOverrides] = useState({});

  const items = useMemo(() => mediaItems || [], [mediaItems]);

  function handleChange(mediaId, next) {
    setOverrides((prev) => ({ ...prev, [mediaId]: next }));
  }

  // Live count of monitored posts. Merges initial server state with any
  // toggles the coach has made this session so the "no posts monitored"
  // callout dismisses as soon as the first toggle flips on.
  const monitoredCount = useMemo(() => {
    return items.reduce((acc, item) => {
      const state = overrides[item.id] ?? monitoringByMediaId[item.id] ?? null;
      return state?.enabled === true ? acc + 1 : acc;
    }, 0);
  }, [items, overrides, monitoringByMediaId]);

  return (
    <div className="max-w-4xl mx-auto p-3 md:p-5 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5 text-stone-900" />
          <h1 className="text-2xl font-bold tracking-tight">Comment to DM</h1>
        </div>
        <p className="text-sm text-stone-600">
          Pick which posts Clinchd should watch. When someone comments on
          a watched post, the classifier decides whether to DM, queue for
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

      {items.length > 0 && monitoredCount === 0 && (
        <div
          className="rounded-[2rem] border p-4 text-sm"
          style={{
            backgroundColor: "#fef3c7",
            borderColor: "#fde68a",
            color: "#78350f",
          }}
        >
          No posts being watched yet. Toggle a post ON below to start
          replying to commenters with AI.
        </div>
      )}

      {items.length === 0 && !mediaError && <NoPostsEmptyState />}

      <div className="space-y-4">
        {items.map((item) => {
          const initial = overrides[item.id] ?? monitoringByMediaId[item.id] ?? null;
          return (
            <PostCard
              key={item.id}
              item={item}
              initial={initial}
              templatesByClass={templatesByClass}
              onChange={(next) => handleChange(item.id, next)}
            />
          );
        })}
      </div>

      {items.length === 25 && (
        <p className="text-xs text-stone-500 text-center pt-2">
          Showing your 25 most recent posts. Pagination beyond 25 isn&apos;t
          in this release — older posts can be watched once we ship it.
        </p>
      )}
    </div>
  );
}
