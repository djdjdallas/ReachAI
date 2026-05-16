import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";
import HistoryFeedbackRow from "./HistoryFeedbackRow";
import HistoryFilters from "./HistoryFilters";
import F1Panel from "./F1Panel";

export const metadata = {
  title: "Classifier history (Shadow)",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 100;
const CLASS_OPTIONS = [
  "HIGH_INTENT",
  "ENGAGED_NOT_BUYING",
  "CRITICAL_NEGATIVE",
  "LOW_SIGNAL",
  "NOT_A_LEAD",
  "SPAM",
  "UNCERTAIN",
];

function parseDate(value) {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function ClassifierHistoryPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isIntentClassifierEnabled(user.email)) notFound();

  const params = (await searchParams) || {};
  const classFilter =
    typeof params.class === "string" && CLASS_OPTIONS.includes(params.class)
      ? params.class
      : null;
  const fromDate = parseDate(params.from);
  const toDate = parseDate(params.to);

  let query = supabase
    .from("comment_classifications")
    .select(
      `
      id,
      comment_text,
      class,
      confidence,
      classified_at,
      reasoning,
      posts ( permalink, ig_media_id ),
      classifier_feedback ( id, feedback, correct_class, notes )
    `
    )
    .eq("creator_id", user.id)
    .order("classified_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (classFilter) query = query.eq("class", classFilter);
  if (fromDate) query = query.gte("classified_at", fromDate.toISOString());
  if (toDate) query = query.lte("classified_at", toDate.toISOString());

  const { data: rows, error } = await query;

  // F1 aggregate: a single GROUP BY in Postgres returns the confusion
  // matrix, so the page only ships the summarized counts to JS. RLS still
  // applies because the RPC runs SECURITY INVOKER and the WHERE clause
  // pins to p_creator_id.
  const { data: confusion } = await supabase.rpc(
    "classifier_confusion_matrix",
    { p_creator_id: user.id }
  );

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <h1 className="text-2xl font-bold">Classifier history</h1>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin/classifier" className="underline text-stone-600">
              Playground
            </Link>
            <Link
              href="/admin/comment-queue"
              className="underline text-stone-600"
            >
              Comment queue
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Last {PAGE_SIZE} classifications with inline correction. F1 panel
          aggregates every feedback row you&apos;ve labeled with a correct class.
        </p>
      </div>

      <F1Panel rows={confusion || []} classes={CLASS_OPTIONS} />

      <HistoryFilters
        classOptions={CLASS_OPTIONS}
        currentClass={classFilter}
        currentFrom={typeof params.from === "string" ? params.from : ""}
        currentTo={typeof params.to === "string" ? params.to : ""}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Failed to load history: {error.message}
        </div>
      )}

      <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">When</th>
              <th className="text-left px-3 py-2 font-medium">Comment</th>
              <th className="text-left px-3 py-2 font-medium">Class</th>
              <th className="text-left px-3 py-2 font-medium">Conf</th>
              <th className="text-left px-3 py-2 font-medium">Feedback</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {(rows || []).map((row) => (
              <HistoryFeedbackRow
                key={row.id}
                row={row}
                classOptions={CLASS_OPTIONS}
              />
            ))}
            {(!rows || rows.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-stone-500"
                >
                  No classifications match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
