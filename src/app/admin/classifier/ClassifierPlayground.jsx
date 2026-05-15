"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Loader2,
  ThumbsUp,
  ThumbsDown,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Send,
  Inbox,
  Ban,
  Settings2,
} from "lucide-react";

const CORAL = "#ff7e67";

const PLACEHOLDER_OFFER = {
  offer_name: "6-Week Sprint Program",
  offer_price_cents: 49700,
  offer_url: "https://clinchd.io/sprint",
  ideal_customer: "Runners training for a half-marathon who want a structured plan.",
  objections: ["too expensive", "not enough time", "already have a coach"],
  qualification_questions: [
    "What's your current weekly mileage?",
    "What race are you training for?",
  ],
};

const ACTION_META = {
  dm: { label: "Send DM", icon: Send, tone: "text-green-700 bg-green-50 border-green-200" },
  queue_review: {
    label: "Queue for review",
    icon: Inbox,
    tone: "text-amber-700 bg-amber-50 border-amber-200",
  },
  ignore: { label: "Ignore", icon: Ban, tone: "text-stone-600 bg-stone-50 border-stone-200" },
  none: {
    label: "No action",
    icon: Ban,
    tone: "text-stone-600 bg-stone-50 border-stone-200",
  },
};

const CLASS_STYLES = {
  HIGH_INTENT: "bg-green-500/15 text-green-700 border border-green-500/30",
  ENGAGED_NOT_BUYING: "bg-blue-500/15 text-blue-700 border border-blue-500/30",
  CRITICAL_NEGATIVE: "bg-red-500/15 text-red-700 border border-red-500/30",
  LOW_SIGNAL: "bg-stone-400/15 text-stone-700 border border-stone-400/30",
  NOT_A_LEAD: "bg-purple-500/15 text-purple-700 border border-purple-500/30",
  SPAM: "bg-gray-500/20 text-gray-700 border border-gray-500/30",
  UNCERTAIN: "bg-yellow-500/15 text-yellow-700 border border-yellow-500/30",
};

function ClassBadge({ value }) {
  const cls = CLASS_STYLES[value] || CLASS_STYLES.UNCERTAIN;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {value}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-stone-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: CORAL }}
        />
      </div>
      <span className="text-xs font-mono text-stone-600 w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

export default function ClassifierPlayground({ savedOffer = null }) {
  const [caption, setCaption] = useState(
    "New cohort opens Friday — comment COACH for details on the 6-week program."
  );
  const initialOffer = savedOffer || PLACEHOLDER_OFFER;
  const [offerText, setOfferText] = useState(
    JSON.stringify(initialOffer, null, 2)
  );
  const [showOfferOverride, setShowOfferOverride] = useState(false);
  const [comment, setComment] = useState("how much is the program? i'm ready to join");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [feedbackStatus, setFeedbackStatus] = useState(null);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  async function handleClassify() {
    setLoading(true);
    setError(null);
    setFeedbackStatus(null);

    let offer = null;
    if (showOfferOverride && offerText.trim()) {
      try {
        offer = JSON.parse(offerText);
      } catch {
        setError("Override offer must be valid JSON (or hide the override).");
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/admin/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caption,
          offer,
          offerOverride: showOfferOverride && Boolean(offer),
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Classification failed.");
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err.message || "Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(kind) {
    if (!result?.classificationId) return;
    setSendingFeedback(true);
    setFeedbackStatus(null);
    try {
      const res = await fetch("/api/admin/classify/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classificationId: result.classificationId,
          feedback: kind,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackStatus({ ok: false, message: data.error || "Failed" });
      } else {
        setFeedbackStatus({ ok: true, message: `Recorded (${kind})` });
      }
    } catch (err) {
      setFeedbackStatus({ ok: false, message: err.message || "Network error" });
    } finally {
      setSendingFeedback(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FlaskConical className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold">Intent Classifier (Shadow)</h1>
          <Badge variant="secondary" className="text-xs">
            Admin only
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a post caption, offer context, and a comment to preview the
          Claude Haiku 4.5 classifier. Shadow mode — nothing is sent to
          Instagram.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Inputs</CardTitle>
          <CardDescription>
            Caption + offer feed the cached context bundle. Comment is the
            only uncached per-call content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 block mb-1">
              Post caption
            </label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder="Paste the full post caption here"
            />
          </div>

          <div className="rounded-lg border border-stone-200 bg-stone-50/40 px-3 py-2 text-xs flex items-center justify-between gap-2">
            <span className="text-stone-600">
              {savedOffer ? (
                <>
                  Using saved offer{" "}
                  <span className="font-mono text-stone-800">
                    {savedOffer.offer_name}
                  </span>{" "}
                  from{" "}
                  <a href="/settings/offer" className="underline">
                    Settings → Your Offer
                  </a>
                  .
                </>
              ) : (
                <>
                  No saved offer found —{" "}
                  <a href="/settings/offer" className="underline">
                    save your real offer
                  </a>{" "}
                  so the classifier doesn&apos;t run against placeholder data.
                </>
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowOfferOverride((v) => !v)}
              className="text-xs"
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              {showOfferOverride ? "Hide override" : "Advanced: override"}
            </Button>
          </div>

          {showOfferOverride && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 block mb-1">
                Override offer (JSON, this test only)
              </label>
              <Textarea
                value={offerText}
                onChange={(e) => setOfferText(e.target.value)}
                rows={8}
                className="text-xs font-mono"
                placeholder='{"offer_name":"...","offer_price_cents":49700,"ideal_customer":"...","objections":["..."],"qualification_questions":["..."]}'
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Only used for this classification — does not modify your saved
                offer.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-stone-500 block mb-1">
              Comment to classify
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="text-sm"
              placeholder="Paste the Instagram comment text here"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleClassify}
              disabled={loading || !comment.trim()}
              className="text-white"
              style={{ backgroundColor: CORAL }}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Classifying…
                </>
              ) : (
                "Classify"
              )}
            </Button>
            {error && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                {error}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Classification</CardTitle>
            <CardDescription>
              Post {result.postId.slice(0, 8)}… · Bundle v{result.bundleVersion}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <ClassBadge value={result.classification.class} />
              <Badge variant="outline" className="text-xs font-mono">
                {result.classification.language}
              </Badge>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">
                Confidence
              </p>
              <ConfidenceBar value={result.classification.confidence} />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-1">
                Reasoning
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">
                {result.classification.reasoning}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
                Signals
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(result.classification.signals || []).map((s, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full bg-stone-100 border border-stone-200 px-2.5 py-0.5 text-xs font-mono text-stone-700"
                  >
                    {s}
                  </span>
                ))}
                {(!result.classification.signals ||
                  result.classification.signals.length === 0) && (
                  <span className="text-xs text-stone-400">—</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-stone-200">
              <Metric label="Input tok" value={result.usage.inputTokens} />
              <Metric label="Output tok" value={result.usage.outputTokens} />
              <Metric
                label="Cache read"
                value={result.usage.cacheReadTokens}
                highlight={result.usage.cacheReadTokens > 0}
              />
              <Metric
                label="Cache write"
                value={result.usage.cacheCreationTokens}
              />
              <Metric
                label="Latency"
                value={`${result.usage.latencyMs} ms`}
              />
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-stone-200">
              <span className="text-xs text-stone-500 mr-2">Was this right?</span>
              <Button
                size="sm"
                variant="outline"
                disabled={sendingFeedback}
                onClick={() => handleFeedback("thumbs_up")}
              >
                <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={sendingFeedback}
                onClick={() => handleFeedback("thumbs_down")}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1.5" />
                No
              </Button>
              {feedbackStatus && (
                <span
                  className={`text-xs flex items-center gap-1 ${
                    feedbackStatus.ok ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {feedbackStatus.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {feedbackStatus.message}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result?.trigger && <TriggerCard trigger={result.trigger} />}
    </div>
  );
}

function TriggerCard({ trigger }) {
  const meta = ACTION_META[trigger.action] || ACTION_META.none;
  const Icon = meta.icon;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Would trigger</CardTitle>
        <CardDescription>
          Shadow mode — nothing is sent. This is what the agent would do if
          this were a live comment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${meta.tone}`}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </div>

        <div className="text-xs text-stone-500">
          Reason:{" "}
          <span className="font-mono text-stone-700">{trigger.reason}</span>
        </div>

        {trigger.action === "dm" && trigger.rendered && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">
              Rendered DM
            </p>
            <p className="text-sm whitespace-pre-wrap text-stone-800">
              {trigger.rendered}
            </p>
          </div>
        )}

        {trigger.action === "queue_review" && (
          <p className="text-xs text-stone-500">
            Queued for the founder to review at{" "}
            <a href="/admin/comment-queue" className="underline">
              /admin/comment-queue
            </a>
            .
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, highlight }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight ? "border-[#ff7e67]/40 bg-[#ff7e67]/5" : "border-stone-200"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="text-sm font-mono font-semibold text-stone-800">
        {value ?? 0}
      </p>
    </div>
  );
}
