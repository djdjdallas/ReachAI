"use client";

import { useState } from "react";
import {
  MessagesSquare,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

const CORAL = "#ff7e67";

// Suggestions only — rendered in the UI, never written to the DB until the
// coach explicitly adds one. Keeping them client-side preserves the
// "feature off + zero templates" default state for every account.
const SUGGESTED_REPLIES = [
  "sent! check your dms 🙌",
  "just slid into your dms ✅",
  "replied — check your inbox 📩",
  "done! it's in your messages 🙌",
];

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function StatusChip({ state }) {
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-stone-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-stone-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Saved
      </span>
    );
  }
  return null;
}

function ReplyRow({ template, onUpdate, onDelete }) {
  const [text, setText] = useState(template.reply_text);
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);

  async function persist(updates) {
    setState("saving");
    setError(null);
    try {
      const data = await api("PATCH", "/api/settings/comment-reply-templates", {
        id: template.id,
        ...updates,
      });
      onUpdate(data.template);
      setState("saved");
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  async function handleBlur() {
    const trimmed = text.trim();
    if (!trimmed || trimmed === template.reply_text) {
      setText(template.reply_text);
      return;
    }
    await persist({ reply_text: trimmed });
  }

  async function handleDelete() {
    setState("saving");
    setError(null);
    try {
      await api("DELETE", "/api/settings/comment-reply-templates", {
        id: template.id,
      });
      onDelete(template.id);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2.5">
        <Switch
          checked={template.is_active}
          onCheckedChange={(next) => persist({ is_active: next })}
          aria-label={template.is_active ? "Deactivate reply" : "Activate reply"}
        />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          maxLength={500}
          className={`flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
            template.is_active ? "text-stone-800" : "text-stone-400"
          }`}
          style={{ "--tw-ring-color": CORAL }}
        />
        <StatusChip state={state} />
        <button
          type="button"
          onClick={handleDelete}
          title="Delete reply"
          className="shrink-0 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-600 pl-12">{error}</p>}
    </div>
  );
}

export default function PublicReplySection({ initialEnabled, initialTemplates }) {
  const [enabled, setEnabled] = useState(initialEnabled === true);
  const [templates, setTemplates] = useState(initialTemplates || []);
  const [toggleState, setToggleState] = useState("idle");
  const [toggleError, setToggleError] = useState(null);
  const [newText, setNewText] = useState("");
  const [addState, setAddState] = useState("idle");
  const [addError, setAddError] = useState(null);

  async function handleToggle(next) {
    setEnabled(next); // optimistic — reverted on failure
    setToggleState("saving");
    setToggleError(null);
    try {
      await api("POST", "/api/settings/comment-public-reply", { enabled: next });
      setToggleState("saved");
      setTimeout(() => setToggleState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err) {
      setEnabled(!next);
      setToggleError(err.message);
      setToggleState("idle");
    }
  }

  async function addReply(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    setAddState("saving");
    setAddError(null);
    try {
      const data = await api("POST", "/api/settings/comment-reply-templates", {
        reply_text: trimmed,
      });
      setTemplates((prev) => [...prev, data.template]);
      setNewText("");
      setAddState("idle");
    } catch (err) {
      setAddError(err.message);
      setAddState("idle");
    }
  }

  function handleUpdate(updated) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  }

  function handleDelete(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const existingTexts = new Set(templates.map((t) => t.reply_text));
  const suggestions = SUGGESTED_REPLIES.filter((s) => !existingTexts.has(s));
  const activeCount = templates.filter((t) => t.is_active).length;

  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6 space-y-4"
      style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessagesSquare className="h-4 w-4" style={{ color: CORAL }} />
            <p className="text-base font-semibold text-stone-900">
              Post a public reply under trigger comments{" "}
              <span className="font-normal text-stone-400">(optional)</span>
            </p>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            After Clinchd DMs a commenter, it can also leave a short public
            reply under their comment (&ldquo;sent! check your dms 🙌&rdquo;) —
            a nudge that gets other lurkers commenting too. Off by default. We
            rotate through your replies to keep them natural — Instagram may
            flag repetitive identical comments.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusChip state={toggleState} />
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            aria-label="Post a public reply under trigger comments"
          />
        </div>
      </div>
      {toggleError && <p className="text-xs text-red-600">{toggleError}</p>}

      {enabled && (
        <>
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wide">
              Your reply pool{" "}
              <span className="normal-case font-normal">
                ({activeCount} active)
              </span>
            </p>
            {templates.length === 0 && (
              <p className="text-xs text-stone-500 italic">
                No replies yet — nothing will be posted until you add at least
                one. Add a few variations so they rotate.
              </p>
            )}
            {templates.map((t) => (
              <ReplyRow
                key={t.id}
                template={t}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {enabled && activeCount === 1 && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                With a single active reply the same text posts every time.
                Add one or two more so Clinchd can rotate them.
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addReply(newText);
                }
              }}
              maxLength={500}
              placeholder="Write a new reply…"
              className="flex-1 min-w-0 rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2"
              style={{ "--tw-ring-color": CORAL }}
            />
            <button
              type="button"
              onClick={() => addReply(newText)}
              disabled={addState === "saving" || !newText.trim()}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: CORAL }}
            >
              {addState === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Add
            </button>
          </div>
          {addError && <p className="text-xs text-red-600">{addError}</p>}

          {suggestions.length > 0 && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1.5">
                Suggestions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addReply(s)}
                    disabled={addState === "saving"}
                    className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3 opacity-60" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
