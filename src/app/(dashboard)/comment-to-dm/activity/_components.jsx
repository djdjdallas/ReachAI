import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
} from "lucide-react";

export const CORAL = "#ff7e67";
export const CARD_SHADOW = "0 1px 0 rgba(15,15,15,0.04)";

export const INTENT_BADGE_STYLES = {
  HIGH_INTENT: "bg-emerald-100 text-emerald-800",
  LOW_SIGNAL: "bg-blue-100 text-blue-800",
  UNCERTAIN: "bg-yellow-100 text-yellow-800",
  ENGAGED_NOT_BUYING: "bg-purple-100 text-purple-800",
  NOT_A_LEAD: "bg-stone-100 text-stone-600",
  CRITICAL_NEGATIVE: "bg-red-100 text-red-800",
  SPAM: "bg-stone-100 text-stone-500",
};

export const INTENT_LABELS = {
  HIGH_INTENT: "High intent",
  LOW_SIGNAL: "Low signal",
  UNCERTAIN: "Uncertain",
  ENGAGED_NOT_BUYING: "Engaged (not buying)",
  NOT_A_LEAD: "Not a lead",
  CRITICAL_NEGATIVE: "Negative",
  SPAM: "Spam",
};

export function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Pill({ tone, icon: Icon, children }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    yellow: "bg-yellow-100 text-yellow-800",
    gray: "bg-stone-100 text-stone-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone] || tones.gray}`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

export function Outcome({ log }) {
  if (!log) {
    return (
      <div className="flex items-start gap-2">
        <Pill tone="yellow" icon={Clock}>
          Pending
        </Pill>
        <p className="text-xs text-stone-500 mt-1">
          Classified but not yet processed for dispatch.
        </p>
      </div>
    );
  }

  if (log.decided_action === "dm" && log.dispatched === true) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Pill tone="green" icon={CheckCircle2}>
            DM sent
          </Pill>
          {log.dispatched_at && (
            <span className="text-xs text-stone-400">
              {relativeTime(log.dispatched_at)}
            </span>
          )}
        </div>
        {log.rendered_dm && (
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {log.rendered_dm}
          </div>
        )}
      </div>
    );
  }

  if (log.decided_action === "dm" && log.dispatched === false) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Pill tone="red" icon={XCircle}>
            DM failed
          </Pill>
          {log.dispatch_retryable && (
            <span className="text-xs text-stone-400">will retry</span>
          )}
        </div>
        {log.dispatch_error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-800 leading-relaxed whitespace-pre-wrap">
            {log.dispatch_error}
          </div>
        )}
      </div>
    );
  }

  if (log.decided_action === "skip") {
    return (
      <div className="flex items-start gap-2">
        <Pill tone="gray" icon={MinusCircle}>
          No reply sent
        </Pill>
        <p className="text-xs text-stone-500 mt-1">
          Configured to not auto-reply for this intent.
        </p>
      </div>
    );
  }

  if (log.decided_action === "queue_review") {
    return (
      <div className="flex items-start gap-2">
        <Pill tone="yellow" icon={Clock}>
          Queued for review
        </Pill>
        <p className="text-xs text-stone-500 mt-1">
          Held back for manual approval before any DM goes out.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Pill tone="gray" icon={MinusCircle}>
        {log.decided_action || "Unknown"}
      </Pill>
    </div>
  );
}

// `showPost` controls whether the per-row IG permalink renders. In the
// per-post drilldown the permalink is in the page header already, so we
// hide it on each row to avoid redundancy.
export function ActivityRow({ row, showPost = true }) {
  const log = Array.isArray(row.comment_to_dm_log)
    ? row.comment_to_dm_log[0]
    : row.comment_to_dm_log;
  const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;

  const intentLabel = INTENT_LABELS[row.class] || row.class;
  const intentStyle =
    INTENT_BADGE_STYLES[row.class] || "bg-stone-100 text-stone-600";
  const confidencePct =
    typeof row.confidence === "number"
      ? `${Math.round(row.confidence * 100)}%`
      : null;

  return (
    <div
      className="rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-semibold text-stone-900 text-sm">
          @{row.ig_commenter_username || "unknown"}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${intentStyle}`}
        >
          {intentLabel}
        </span>
        {confidencePct && (
          <span className="text-xs text-stone-500 font-medium">
            {confidencePct} confidence
          </span>
        )}
        <span className="text-xs text-stone-400 ml-auto">
          {relativeTime(row.classified_at)}
        </span>
      </div>

      <p className="mt-3 text-sm text-stone-700 leading-relaxed line-clamp-2">
        {row.comment_text || <em className="text-stone-400">No text</em>}
      </p>

      {showPost && post?.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          View post on Instagram
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      <div className="mt-4 pt-4 border-t border-stone-100">
        <Outcome log={log} />
      </div>
    </div>
  );
}
