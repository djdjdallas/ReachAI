import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  MessageCircleReply,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import { CORAL, CARD_SHADOW, ActivityRow } from "../_components";

export const metadata = {
  title: "Post activity · Comment to DM · Clinchd",
  robots: { index: false, follow: false },
};

const DRILLDOWN_LIMIT = 200;

async function getPostAndActivity(supabase, userId, postId) {
  const { data: post, error: postErr } = await supabase
    .from("posts")
    .select("id, ig_media_id, permalink, caption, media_type, posted_at")
    .eq("id", postId)
    .eq("creator_id", userId)
    .maybeSingle();

  if (postErr || !post) {
    return { post: null, activity: [] };
  }

  const { data: activity, error: actErr } = await supabase
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
      comment_to_dm_log (
        decided_action,
        rendered_dm,
        dispatched,
        dispatched_at,
        dispatched_message_id,
        dispatch_error,
        dispatch_retryable
      ),
      comment_public_reply_log (
        dispatch_status,
        reply_text,
        ig_reply_comment_id,
        error_message,
        created_at
      )
    `
    )
    .eq("creator_id", userId)
    .eq("post_id", postId)
    .order("classified_at", { ascending: false })
    .limit(DRILLDOWN_LIMIT);

  if (actErr) {
    console.error("[activity-drilldown] fetch error:", actErr);
    return { post, activity: [] };
  }

  return { post, activity: activity || [] };
}

export default async function PostActivityDrilldownPage({ params }) {
  const { postId } = await params;

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

  const { post, activity } = await getPostAndActivity(supabase, user.id, postId);
  if (!post) notFound();

  const stats = summarize(activity);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <Link
          href="/comment-to-dm/activity"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All activity
        </Link>
      </div>

      <div
        className="rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div className="flex items-center gap-2 mb-2">
          <MessageCircleReply className="h-5 w-5" style={{ color: CORAL }} />
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Post activity
          </span>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-stone-900 leading-snug">
          {post.caption?.trim() || "(No caption)"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
          {post.media_type && (
            <span className="font-semibold uppercase tracking-wide text-stone-600">
              {humanizeMediaType(post.media_type)}
            </span>
          )}
          {post.posted_at && (
            <>
              <span className="text-stone-300">·</span>
              <span>Posted {formatPostedAt(post.posted_at)}</span>
            </>
          )}
          {post.permalink && (
            <>
              <span className="text-stone-300">·</span>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-stone-600 hover:text-stone-900"
              >
                View on Instagram
                <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <Stat label="classified" value={stats.total} />
          <Stat label="DM sent" value={stats.dispatched} tone="green" />
          <Stat label="failed" value={stats.failed} tone="red" />
          <Stat label="pending" value={stats.pending} tone="yellow" />
          <Stat label="skipped" value={stats.skipped} tone="gray" />
        </div>
      </div>

      {activity.length === 0 ? (
        <div
          className="rounded-[2rem] border border-dashed border-stone-300 bg-white px-8 py-10 text-center"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <p className="text-sm text-stone-600">
            No comments classified on this post yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((row) => (
            <ActivityRow key={row.id} row={row} showPost={false} />
          ))}
          {activity.length === DRILLDOWN_LIMIT && (
            <p className="text-xs text-stone-400 text-center pt-2">
              Showing the {DRILLDOWN_LIMIT} most recent. Older activity is not displayed.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function summarize(activity) {
  const s = { total: 0, dispatched: 0, failed: 0, pending: 0, skipped: 0 };
  for (const row of activity) {
    s.total += 1;
    const log = Array.isArray(row.comment_to_dm_log)
      ? row.comment_to_dm_log[0]
      : row.comment_to_dm_log;
    if (!log) {
      s.pending += 1;
    } else if (log.decided_action === "dm" && log.dispatched === true) {
      s.dispatched += 1;
    } else if (log.decided_action === "dm" && log.dispatched === false) {
      s.failed += 1;
    } else if (log.decided_action === "skip") {
      s.skipped += 1;
    } else if (log.decided_action === "queue_review") {
      s.pending += 1;
    }
  }
  return s;
}

function Stat({ label, value, tone }) {
  const toneClass =
    {
      green: "text-emerald-700",
      red: "text-red-700",
      yellow: "text-yellow-700",
      gray: "text-stone-500",
    }[tone] || "text-stone-700";
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`text-lg font-bold tabular-nums ${toneClass}`}>{value}</span>
      <span className="text-xs text-stone-500">{label}</span>
    </span>
  );
}

function humanizeMediaType(type) {
  if (!type) return "Post";
  const t = String(type).toUpperCase();
  if (t === "VIDEO") return "Video";
  if (t === "REEL" || t === "REELS") return "Reel";
  if (t === "CAROUSEL_ALBUM" || t === "CAROUSEL") return "Carousel";
  if (t === "IMAGE") return "Photo";
  return type[0].toUpperCase() + type.slice(1).toLowerCase();
}

function formatPostedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
