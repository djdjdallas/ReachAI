"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown, Loader2, CheckCircle2 } from "lucide-react";

function snippet(text, max = 120) {
  if (typeof text !== "string") return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export default function HistoryFeedbackRow({ row, classOptions }) {
  const router = useRouter();
  const existing = Array.isArray(row.classifier_feedback)
    ? row.classifier_feedback[0]
    : null;

  const [feedback, setFeedback] = useState(existing?.feedback || "");
  const [correctClass, setCorrectClass] = useState(
    existing?.correct_class || ""
  );
  const [notes, setNotes] = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  async function submit(nextFeedback) {
    const finalFeedback = nextFeedback || feedback;
    if (!finalFeedback) {
      setError("Pick thumbs up or down first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/classify/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationId: row.id,
          feedback: finalFeedback,
          correctClass: correctClass || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed.");
      } else {
        setFeedback(finalFeedback);
        setSavedAt(Date.now());
        // Bust the server cache so the F1 panel reflects the new label.
        router.refresh();
      }
    } catch (err) {
      setError(err.message || "Network error.");
    } finally {
      setSaving(false);
    }
  }

  const post = row.posts;
  const dt = row.classified_at ? new Date(row.classified_at) : null;
  const when = dt
    ? `${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "—";

  return (
    <tr className="align-top">
      <td className="px-3 py-3 text-xs text-stone-500 whitespace-nowrap">
        {when}
      </td>
      <td className="px-3 py-3 max-w-md">
        <p className="text-stone-800">{snippet(row.comment_text)}</p>
        {post?.permalink && (
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-stone-500 underline"
          >
            View post
          </a>
        )}
      </td>
      <td className="px-3 py-3 text-xs font-mono whitespace-nowrap">
        {row.class}
      </td>
      <td className="px-3 py-3 text-xs font-mono whitespace-nowrap">
        {Math.round((row.confidence || 0) * 100)}%
      </td>
      <td className="px-3 py-3 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => submit("thumbs_up")}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${
              feedback === "thumbs_up"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            <ThumbsUp className="h-3 w-3" /> Up
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submit("thumbs_down")}
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${
              feedback === "thumbs_down"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-stone-200 text-stone-600 hover:bg-stone-50"
            }`}
          >
            <ThumbsDown className="h-3 w-3" /> Down
          </button>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-stone-400" />}
          {savedAt && !saving && !error && (
            <span className="inline-flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <select
            value={correctClass}
            onChange={(e) => setCorrectClass(e.target.value)}
            onBlur={() => feedback && submit()}
            className="rounded border border-stone-200 px-2 py-1 text-xs bg-white"
          >
            <option value="">— correct class —</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => feedback && submit()}
          rows={2}
          placeholder="Notes (optional)"
          className="w-full rounded border border-stone-200 px-2 py-1 text-xs"
        />
        {error && <div className="mt-1 text-[11px] text-red-600">{error}</div>}
      </td>
    </tr>
  );
}
