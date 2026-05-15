import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";

export const metadata = {
  title: "Comment queue (Shadow)",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 100;
const ACTION_OPTIONS = ["dm", "queue_review", "ignore", "none"];

const ACTION_TONE = {
  dm: "bg-green-50 text-green-700 border-green-200",
  queue_review: "bg-amber-50 text-amber-700 border-amber-200",
  ignore: "bg-stone-50 text-stone-600 border-stone-200",
  none: "bg-stone-50 text-stone-600 border-stone-200",
};

function parseDate(value) {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function snippet(text, max = 140) {
  if (typeof text !== "string") return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export default async function CommentQueuePage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isIntentClassifierEnabled(user.email)) notFound();

  const params = (await searchParams) || {};
  const actionFilter =
    typeof params.action === "string" && ACTION_OPTIONS.includes(params.action)
      ? params.action
      : null;
  const fromDate = parseDate(params.from);
  const toDate = parseDate(params.to);

  let query = supabase
    .from("comment_to_dm_log")
    .select(
      `
      id,
      decided_action,
      rendered_dm,
      dispatched,
      simulated_at,
      comment_classifications (
        id,
        comment_text,
        class,
        confidence,
        ig_commenter_username,
        posts ( permalink )
      )
    `
    )
    .eq("creator_id", user.id)
    .order("simulated_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (actionFilter) query = query.eq("decided_action", actionFilter);
  if (fromDate) query = query.gte("simulated_at", fromDate.toISOString());
  if (toDate) query = query.lte("simulated_at", toDate.toISOString());

  const { data: rows, error } = await query;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold">Comment queue (shadow)</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin/classifier" className="underline text-stone-600">
              Playground
            </Link>
            <Link
              href="/admin/classifier/history"
              className="underline text-stone-600"
            >
              History
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Every classification produces a row here showing what the agent
          would do. Nothing has been sent. Last {PAGE_SIZE} simulated outcomes.
        </p>
      </div>

      <form
        method="GET"
        className="flex items-end gap-3 flex-wrap rounded-lg border border-stone-200 bg-white p-3"
      >
        <label className="flex flex-col text-xs text-stone-600">
          <span className="mb-1 font-semibold uppercase tracking-wide">
            Action
          </span>
          <select
            name="action"
            defaultValue={actionFilter || ""}
            className="rounded border border-stone-300 px-2 py-1 text-sm bg-white"
          >
            <option value="">All</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-xs text-stone-600">
          <span className="mb-1 font-semibold uppercase tracking-wide">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={typeof params.from === "string" ? params.from : ""}
            className="rounded border border-stone-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col text-xs text-stone-600">
          <span className="mb-1 font-semibold uppercase tracking-wide">To</span>
          <input
            type="date"
            name="to"
            defaultValue={typeof params.to === "string" ? params.to : ""}
            className="rounded border border-stone-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-stone-900 text-white text-xs font-semibold px-3 py-2"
        >
          Apply
        </button>
        {(actionFilter || params.from || params.to) && (
          <Link
            href="/admin/comment-queue"
            className="text-xs text-stone-500 underline"
          >
            Reset
          </Link>
        )}
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load queue: {error.message}
        </div>
      )}

      <div className="space-y-3">
        {(rows || []).map((row) => {
          const cls = row.comment_classifications;
          const post = cls?.posts;
          const dt = row.simulated_at ? new Date(row.simulated_at) : null;
          return (
            <div
              key={row.id}
              className="rounded-lg border border-stone-200 bg-white p-4 space-y-3"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      ACTION_TONE[row.decided_action] || ACTION_TONE.none
                    }`}
                  >
                    {row.decided_action}
                  </span>
                  {cls?.class && (
                    <span className="text-xs font-mono text-stone-500">
                      {cls.class} · {Math.round((cls.confidence || 0) * 100)}%
                    </span>
                  )}
                  {row.dispatched && (
                    <span className="text-xs font-semibold text-amber-700">
                      DISPATCHED
                    </span>
                  )}
                </div>
                <div className="text-xs text-stone-500">
                  {dt ? dt.toLocaleString() : "—"}
                </div>
              </div>

              {cls?.comment_text && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">
                    Comment
                  </p>
                  <p className="text-sm text-stone-800">
                    {snippet(cls.comment_text)}
                  </p>
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
                </div>
              )}

              {row.rendered_dm && (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-stone-500 mb-1">
                    Would send
                  </p>
                  <p className="text-sm whitespace-pre-wrap text-stone-800">
                    {row.rendered_dm}
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {(!rows || rows.length === 0) && (
          <div className="text-sm text-stone-500 text-center py-12">
            No simulated outcomes match these filters.
          </div>
        )}
      </div>
    </div>
  );
}
