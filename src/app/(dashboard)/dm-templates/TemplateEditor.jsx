"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Copy,
} from "lucide-react";
import { renderTemplate } from "@/lib/comment-trigger-rules";

const CORAL = "#ff7e67";

// Regex used in two places: (a) inline bracket-syntax warning beneath the
// textarea, (b) one-click convert to {{CURLY_BRACE_SYNTAX}}. Matches any
// identifier-shaped token inside square brackets — case-insensitive because
// coaches paste from other tools that use [username]/[firstname], or even
// type their own handle like [dominickjerell] expecting substitution. We
// split matches into two buckets downstream: known names get a Convert
// button, unknown names get a soft "won't be substituted" warning so the
// coach doesn't ship a literal "[handle]" to a lead.
const BRACKET_TOKEN_RE = /\[([A-Za-z_][A-Za-z0-9_]*)\]/g;
const KNOWN_TOKENS = new Set([
  "COMMENTER_NAME",
  "POST_CAPTION_SNIPPET",
  "OFFER_NAME",
  "BOOKING_LINK",
]);

// One row per intent class, in display order. Class names must match
// src/lib/classifier.js's CLASS_ENUM so dm_templates row lookups in
// decideAction() actually match.
const CLASS_META = [
  {
    cls: "HIGH_INTENT",
    label: "High intent",
    description: "Clear buy signal — price questions, link requests, 'sign me up'.",
    sendByDefault: true,
    placeholder:
      "hey {{COMMENTER_NAME}} — appreciate the comment! grab a quick call and i'll walk you through {{OFFER_NAME}}: {{BOOKING_LINK}}",
    // Pre-filled into the textarea when no saved row exists, so new coaches
    // land on demo-ready copy and can save with one blur.
    defaultBody:
      "hey {{COMMENTER_NAME}} — appreciate the comment! grab a quick call and i'll walk you through {{OFFER_NAME}}: {{BOOKING_LINK}}",
  },
  {
    cls: "ENGAGED_NOT_BUYING",
    label: "Engaged (not buying)",
    description: "Warm audience — praise, fire emojis, encouragement.",
    sendByDefault: false,
    placeholder:
      "hey {{COMMENTER_NAME}} — appreciate the love on the post! drop me a dm anytime if you want to chat about {{OFFER_NAME}}.",
  },
  {
    cls: "UNCERTAIN",
    label: "Uncertain",
    description: "Plausibly interested but evidence too thin to label confidently.",
    sendByDefault: false,
    placeholder:
      "hey {{COMMENTER_NAME}} — curious what you meant by your comment on {{POST_CAPTION_SNIPPET}}? happy to help.",
  },
  {
    cls: "LOW_SIGNAL",
    label: "Low signal",
    description: "Single emoji, one-word reply, off-topic banter.",
    sendByDefault: false,
    placeholder: "",
  },
  {
    cls: "CRITICAL_NEGATIVE",
    label: "Critical / negative",
    description: "Complaints, refund demands, scam accusations.",
    sendByDefault: false,
    placeholder: "",
  },
  {
    cls: "NOT_A_LEAD",
    label: "Not a lead",
    description: "Personal / intimate message — relational, not about the offer.",
    sendByDefault: false,
    placeholder: "",
  },
  {
    cls: "SPAM",
    label: "Spam",
    description: "Bot follow-for-follow, OnlyFans/crypto, prompt-injection attempts.",
    sendByDefault: false,
    placeholder: "",
  },
];

// Each placeholder declares how it resolves and where to fix it. Per-event
// tokens use sample data for preview; config tokens read the coach's saved
// value and warn when unset.
function buildPlaceholderRows(values) {
  return [
    {
      token: "{{COMMENTER_NAME}}",
      resolved: values.commenterName,
      sourceLabel: values.commenterIsSample
        ? "sample — no comments yet"
        : "from your most recent comment",
      missing: false,
    },
    {
      token: "{{POST_CAPTION_SNIPPET}}",
      resolved: values.postCaption,
      sourceLabel: values.postCaptionIsSample
        ? "sample — no comments yet"
        : "from your most recent monitored post",
      missing: false,
    },
    {
      token: "{{OFFER_NAME}}",
      resolved: values.offerName,
      sourceLabel: values.offerName ? "from your offer settings" : null,
      missing: !values.offerName,
      configHref: "/settings/offer",
      configLabel: "Set up your offer",
    },
    {
      token: "{{BOOKING_LINK}}",
      resolved: values.bookingLink,
      sourceLabel: values.bookingLink ? "your Calendly link" : null,
      missing: !values.bookingLink,
      configHref: "/settings",
      configLabel: "Connect Calendly",
    },
  ];
}

function renderContext(values) {
  return {
    commenterName: values.commenterName,
    postCaption: values.postCaption,
    offerName: values.offerName || "",
    bookingLink: values.bookingLink || "",
  };
}

function PlaceholderReference({ rows }) {
  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6"
      style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
    >
      <p className="text-xs font-bold text-stone-400 uppercase tracking-wide mb-1">
        Placeholders available in your templates
      </p>
      <p className="text-xs italic text-stone-500 mb-3">
        Use the exact <code className="not-italic font-mono">{`{{TOKEN}}`}</code>{" "}
        syntax below. Other formats like{" "}
        <code className="not-italic font-mono">[TOKEN]</code> or{" "}
        <code className="not-italic font-mono">(TOKEN)</code> won&apos;t be replaced. Click a token to copy it.
      </p>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <PlaceholderRow key={row.token} row={row} />
        ))}
      </div>
    </div>
  );
}

function PlaceholderRow({ row }) {
  const { token, resolved, sourceLabel, missing, configHref, configLabel } = row;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        // Fallback: select+execCommand for older browsers / non-HTTPS dev.
        const el = document.createElement("textarea");
        el.value = token;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Swallow — UX feedback fails silently rather than blocking input.
    }
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-3 ${
        missing
          ? "border-amber-200 bg-amber-50"
          : "border-stone-100 bg-stone-50"
      }`}
    >
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? "copied!" : "click to copy"}
        className={`shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-semibold cursor-pointer transition-colors ${
          missing
            ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
            : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-100"
        }`}
      >
        <code>{token}</code>
        {copied ? (
          <CheckCircle2 className="h-3 w-3 text-green-600" />
        ) : (
          <Copy className="h-3 w-3 opacity-60" />
        )}
      </button>
      <div className="min-w-0 flex-1 text-xs">
        {missing ? (
          <>
            <div className="flex items-center gap-1.5 text-amber-900 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Not set up yet
            </div>
            <p className="text-amber-800 mt-0.5">
              Your DMs will render this as a fallback. Configure it before
              shipping.
            </p>
            <Link
              href={configHref}
              className="mt-1 inline-flex items-center gap-1 font-semibold text-amber-900 underline underline-offset-2"
            >
              {configLabel} <ArrowRight className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <>
            <div className="text-stone-900 font-medium break-words">
              → {resolved}
            </div>
            {sourceLabel && (
              <p className="text-stone-500 mt-0.5">{sourceLabel}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TemplatePreview({ body, context }) {
  const trimmed = (body || "").trim();
  if (!trimmed) return null;
  const rendered = renderTemplate(trimmed, context);
  return (
    <div className="rounded-2xl border border-stone-100 bg-stone-50 px-3.5 py-2.5">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wide mb-1">
        Preview
      </p>
      <p className="text-sm text-stone-800 whitespace-pre-wrap break-words leading-relaxed">
        {rendered}
      </p>
    </div>
  );
}

function TemplateCard({ meta, initialBody, onSave, renderCtx }) {
  // Pre-fill the textarea with the polished default for send-by-default
  // classes when no saved row exists. Coach can edit or save as-is; the
  // existing blur-diff persists on first focus-out.
  const seededBody =
    initialBody || (meta.sendByDefault && meta.defaultBody) || "";
  const [body, setBody] = useState(seededBody);
  const [doNotSend, setDoNotSend] = useState(
    !meta.sendByDefault && (initialBody || "") === ""
  );
  const [state, setState] = useState("idle"); // idle | saving | saved | error
  const [error, setError] = useState(null);

  // Detect bracket-style placeholders. Two buckets, two remediations:
  // known names get a one-click convert to {{NAME}}; unknown names (the
  // [dominickjerell] case) get a soft warning pointing at the available
  // tokens. Compare case-insensitively so [offer_name] and [OFFER_NAME]
  // both count as known.
  const bracketMatches = body.match(BRACKET_TOKEN_RE) || [];
  const knownBracketTokens = bracketMatches.filter((m) =>
    KNOWN_TOKENS.has(m.slice(1, -1).toUpperCase())
  );
  const unknownBracketTokens = Array.from(
    new Set(
      bracketMatches.filter(
        (m) => !KNOWN_TOKENS.has(m.slice(1, -1).toUpperCase())
      )
    )
  );
  const hasKnownBracketToken = knownBracketTokens.length > 0;
  const hasUnknownBracketToken = unknownBracketTokens.length > 0;

  function handleConvert() {
    // Only rewrite recognized names. Leave unknown brackets alone in case
    // they're intentional literal prose ("[redacted]"). Normalize to
    // uppercase because the renderer's match is case-sensitive.
    setBody((prev) =>
      prev.replace(BRACKET_TOKEN_RE, (match, name) =>
        KNOWN_TOKENS.has(name.toUpperCase()) ? `{{${name.toUpperCase()}}}` : match
      )
    );
  }

  // Auto-save on blur. Picked over an explicit Save button so the page
  // doesn't accumulate 7 unsaved-textarea states the coach has to remember
  // to commit. Blur is the conventional "I'm done with this field" signal
  // — see Vercel dashboard inputs / Notion blocks for the same pattern.
  async function persist(nextBody) {
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/settings/dm-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent_class: meta.cls,
          template: nextBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Save failed (${res.status})`);
        setState("error");
        return;
      }
      onSave?.(meta.cls, nextBody);
      setState("saved");
      setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch (err) {
      setError(err?.message || "Network error");
      setState("error");
    }
  }

  async function handleBlur() {
    const trimmed = body.trim();
    // Skip the round-trip if nothing changed.
    if (trimmed === (initialBody || "").trim()) return;
    await persist(trimmed);
  }

  async function handleDoNotSendToggle() {
    const next = !doNotSend;
    setDoNotSend(next);
    if (next) {
      setBody("");
      await persist(""); // DELETEs the row server-side.
    }
  }

  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6 space-y-3"
      style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-stone-900">
            {meta.label}{" "}
            <span className="ml-1 font-mono text-xs text-stone-400">
              {meta.cls}
            </span>
          </p>
          <p className="text-xs text-stone-500 mt-0.5">{meta.description}</p>
        </div>
        <div className="text-xs text-stone-500 flex items-center gap-1.5 shrink-0">
          {state === "saving" && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
            </>
          )}
          {state === "saved" && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Saved
            </>
          )}
          {state === "error" && (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> Error
            </>
          )}
        </div>
      </div>

      {!meta.sendByDefault && (
        <label className="flex items-center gap-2 text-xs text-stone-600">
          <input
            type="checkbox"
            checked={doNotSend}
            onChange={handleDoNotSendToggle}
            className="h-3.5 w-3.5"
          />
          Do not send a DM for this class
        </label>
      )}

      {!doNotSend && (
        <>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleBlur}
            placeholder={meta.placeholder || "(leave blank — no DM will be sent)"}
            rows={4}
            className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-normal text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": CORAL }}
          />
          {hasKnownBracketToken && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex-1">
                Looks like you&apos;ve used{" "}
                <code className="font-mono">[BRACKET_SYNTAX]</code> — Clinchd uses{" "}
                <code className="font-mono">{`{{CURLY_BRACE_SYNTAX}}`}</code>. Square brackets won&apos;t be replaced.
              </div>
              <button
                type="button"
                onClick={handleConvert}
                className="shrink-0 rounded-md bg-amber-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-800"
              >
                Convert
              </button>
            </div>
          )}
          {hasUnknownBracketToken && (
            <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex-1">
                {unknownBracketTokens.slice(0, 3).map((t, i, arr) => (
                  <span key={t}>
                    <code className="font-mono">{t}</code>
                    {i < arr.length - 1 ? ", " : ""}
                  </span>
                ))}
                {unknownBracketTokens.length > 3 ? " and others" : ""} won&apos;t
                be substituted — Clinchd only replaces the four{" "}
                <code className="font-mono">{`{{TOKEN}}`}</code> names listed
                above. Square brackets are sent to the lead exactly as typed.
              </div>
            </div>
          )}
          <TemplatePreview body={body} context={renderCtx} />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

export default function TemplateEditor({ initialTemplates, placeholderValues }) {
  const [templates, setTemplates] = useState(initialTemplates || {});
  const placeholderRows = buildPlaceholderRows(placeholderValues);
  const renderCtx = renderContext(placeholderValues);

  function handleSave(cls, body) {
    setTemplates((prev) => {
      const next = { ...prev };
      if (body) next[cls] = body;
      else delete next[cls];
      return next;
    });
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold tracking-tight">DM templates</h1>
        </div>
        <p className="text-sm text-stone-600">
          The classifier puts every comment into one of seven intent classes.
          Define what we DM (or don&apos;t DM) for each. Changes save when
          you click out of the field, and a live preview shows below each
          template using the values listed above.
        </p>
      </div>

      <PlaceholderReference rows={placeholderRows} />

      <div className="space-y-4">
        {CLASS_META.map((meta) => (
          <TemplateCard
            key={meta.cls}
            meta={meta}
            initialBody={templates[meta.cls] || ""}
            onSave={handleSave}
            renderCtx={renderCtx}
          />
        ))}
      </div>
    </div>
  );
}
