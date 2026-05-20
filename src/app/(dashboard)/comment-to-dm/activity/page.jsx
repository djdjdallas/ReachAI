import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageCircleReply,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";

export const metadata = {
  title: "Activity · Comment to DM · Clinchd",
  robots: { index: false, follow: false },
};

const CORAL = "#ff7e67";
const CARD_SHADOW = "0 1px 0 rgba(15,15,15,0.04)";

const INTENT_BADGE_STYLES = {
  HIGH_INTENT: "bg-emerald-100 text-emerald-800",
  LOW_SIGNAL: "bg-blue-100 text-blue-800",
  UNCERTAIN: "bg-yellow-100 text-yellow-800",
  ENGAGED_NOT_BUYING: "bg-purple-100 text-purple-800",
  NOT_A_LEAD: "bg-stone-100 text-stone-600",
  CRITICAL_NEGATIVE: "bg-red-100 text-red-800",
  SPAM: "bg-stone-100 text-stone-500",
};

const INTENT_LABELS = {
  HIGH_INTENT: "High intent",
  LOW_SIGNAL: "Low signal",
  UNCERTAIN: "Uncertain",
  ENGAGED_NOT_BUYING: "Engaged (not buying)",
  NOT_A_LEAD: "Not a lead",
  CRITICAL_NEGATIVE: "Negative",
  SPAM: "Spam",
};

function relativeTime(iso) {
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

async function getActivity(supabase, userId) {
  const { data, error } = await supabase
    .from("comment_classifications")
    .select(
      `
      id,
      ig_comment_id,
      ig_commenter_username,
      comment_text,
      class,
      confidence,
      classified_at,
      posts!inner (
        permalink,
        caption,
        ig_media_id
      ),
      comment_to_dm_log (
        decided_action,
        rendered_dm,
        dispatched,
        dispatched_at,
        dispatched_message_id,
        dispatch_error,
        dispatch_retryable
      )
    `
    )
    .eq("creator_id", userId)
    .order("classified_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[activity-log] fetch error:", error);
    return [];
  }
  return data || [];
}

export default async function CommentActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("plan, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseCommentToDM({ plan: profile?.plan, email: user.email })) {
    redirect("/comment-to-dm");
  }

  const activity = await getActivity(supabase, user.id);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageCircleReply className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold tracking-tight">Comment Activity</h1>
        </div>
        <p className="text-sm text-stone-600">
          Recent comments reviewed by Clinchd on your enabled posts, including
          the classification and the reply sent on your behalf.
        </p>
      </div>

      {activity.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {activity.map((row) => (
            <ActivityRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({ row }) {
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

      {post?.permalink && (
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

function Outcome({ log }) {
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

function Pill({ tone, icon: Icon, children }) {
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

function EmptyState() {
  return (
    <div
      className="rounded-[2rem] border border-dashed border-stone-300 bg-white px-8 py-12 text-center"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <h2 className="text-base font-semibold text-stone-900">
        No comment activity yet
      </h2>
      <p className="mt-2 text-sm text-stone-600 max-w-md mx-auto">
        Once you enable comment review on a post and a comment is left, you&rsquo;ll
        see the original comment, our classification, and any reply sent on your
        behalf here.
      </p>
      <div className="mt-6 flex justify-center gap-3 flex-wrap">
        <Link
          href="/comment-triggers"
          className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: CORAL }}
        >
          Enable a post
        </Link>
        <Link
          href="/comment-to-dm"
          className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
        >
          Overview
        </Link>
      </div>
    </div>
  );
}
