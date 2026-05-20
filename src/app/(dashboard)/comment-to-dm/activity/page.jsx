import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageCircleReply,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import {
  CORAL,
  CARD_SHADOW,
  INTENT_BADGE_STYLES,
  INTENT_LABELS,
  relativeTime,
} from "./_components";

export const metadata = {
  title: "Activity · Comment to DM · Clinchd",
  robots: { index: false, follow: false },
};

// Pragmatic tonight choice: fetch the most recent N classifications joined
// with posts + log and aggregate in JS. We don't have a Supabase RPC for
// group-by yet, and adding one is a schema change. 500 covers a normal
// coach's recent history; if a single account ever exceeds that, promote
// this to an RPC. The drilldown route does its own per-post query so the
// cap here only affects which posts surface on the overview.
const OVERVIEW_LIMIT = 500;

async function getPostsWithActivity(supabase, userId) {
  const { data, error } = await supabase
    .from("comment_classifications")
    .select(
      `
      id,
      class,
      classified_at,
      post_id,
      posts!inner (
        id,
        ig_media_id,
        permalink,
        caption,
        media_type,
        posted_at
      ),
      comment_to_dm_log (
        decided_action,
        dispatched
      )
    `
    )
    .eq("creator_id", userId)
    .order("classified_at", { ascending: false })
    .limit(OVERVIEW_LIMIT);

  if (error) {
    console.error("[activity-overview] fetch error:", error);
    return [];
  }

  const byPost = new Map();
  for (const row of data || []) {
    const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
    if (!post) continue;
    if (!byPost.has(post.id)) {
      byPost.set(post.id, {
        post,
        total: 0,
        dispatched: 0,
        failed: 0,
        pending: 0,
        skipped: 0,
        latestAt: row.classified_at,
        classCounts: {},
      });
    }
    const agg = byPost.get(post.id);
    agg.total += 1;
    agg.classCounts[row.class] = (agg.classCounts[row.class] || 0) + 1;

    const log = Array.isArray(row.comment_to_dm_log)
      ? row.comment_to_dm_log[0]
      : row.comment_to_dm_log;
    if (!log) {
      agg.pending += 1;
    } else if (log.decided_action === "dm" && log.dispatched === true) {
      agg.dispatched += 1;
    } else if (log.decided_action === "dm" && log.dispatched === false) {
      agg.failed += 1;
    } else if (log.decided_action === "skip") {
      agg.skipped += 1;
    } else if (log.decided_action === "queue_review") {
      agg.pending += 1;
    }
  }

  return Array.from(byPost.values()).sort(
    (a, b) => new Date(b.latestAt) - new Date(a.latestAt)
  );
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

  const posts = await getPostsWithActivity(supabase, user.id);

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageCircleReply className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold tracking-tight">Comment Activity</h1>
        </div>
        <p className="text-sm text-stone-600">
          Posts Clinchd is reviewing comments on. Click any post to see the
          original comments, classifications, and replies sent on your behalf.
        </p>
      </div>

      {posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {posts.map((entry) => (
            <PostCard key={entry.post.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ entry }) {
  const { post, total, dispatched, failed, pending, skipped, latestAt, classCounts } = entry;

  const captionSnippet = post.caption
    ? post.caption.replace(/\s+/g, " ").trim()
    : "(No caption)";

  const topClasses = Object.entries(classCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <Link
      href={`/comment-to-dm/activity/${post.id}`}
      className="block rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6 hover:border-stone-300 transition-all group"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500">
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
            <span className="text-stone-300">·</span>
            <span>Last activity {relativeTime(latestAt)}</span>
          </div>

          <p className="mt-1.5 text-sm font-medium text-stone-900 line-clamp-2 leading-relaxed">
            {captionSnippet}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-600">
            <Stat label={total === 1 ? "classified" : "classified"} value={total} />
            {dispatched > 0 && (
              <Stat label="DM sent" value={dispatched} tone="green" />
            )}
            {failed > 0 && <Stat label="failed" value={failed} tone="red" />}
            {pending > 0 && (
              <Stat label="pending" value={pending} tone="yellow" />
            )}
            {skipped > 0 && <Stat label="skipped" value={skipped} tone="gray" />}
          </div>

          {topClasses.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topClasses.map(([cls, count]) => (
                <span
                  key={cls}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    INTENT_BADGE_STYLES[cls] || "bg-stone-100 text-stone-600"
                  }`}
                >
                  {count} {INTENT_LABELS[cls] || cls}
                </span>
              ))}
            </div>
          )}

          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              View on Instagram
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0 mt-1" />
      </div>
    </Link>
  );
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
    <span className="inline-flex items-baseline gap-1">
      <span className={`text-sm font-bold tabular-nums ${toneClass}`}>{value}</span>
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
        see the post here with the original comments, our classification, and
        any reply sent on your behalf.
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
