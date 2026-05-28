import { redirect } from "next/navigation";
import Link from "next/link";
import {
  MessageCircleReply,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";

export const metadata = {
  title: "Comment to DM · Clinchd",
  robots: { index: false, follow: false },
};

const CORAL = "#ff7e67";
const CARD_SHADOW = "0 1px 0 rgba(15,15,15,0.04)";

export default async function CommentToDmLandingPage() {
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
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div
          className="rounded-[2rem] bg-white border border-stone-200 p-8 md:p-10"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Comment-to-DM is on the Unlimited plan
          </h1>
          <p className="mt-3 text-stone-600">
            Pick which posts trigger DMs, set per-intent reply templates, and
            let Clinchd handle the rest. Available on the Unlimited tier.
          </p>
          <div className="mt-6">
            <Link
              href="/billing"
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: CORAL }}
            >
              Upgrade to Unlimited
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const admin = getSupabaseAdmin();
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [postsRes, templatesRes, dmsRes] = await Promise.all([
    admin
      .from("post_monitoring_settings")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("enabled", true),
    admin
      .from("dm_templates")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id),
    admin
      .from("comment_to_dm_log")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("dispatched", true)
      .gt("dispatched_at", thirtyDaysAgo),
  ]);

  const postsCount = postsRes.count ?? 0;
  const templatesCount = templatesRes.count ?? 0;
  const dmsCount = dmsRes.count ?? 0;

  const silentFailure = postsCount > 0 && templatesCount === 0;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageCircleReply className="h-5 w-5" style={{ color: CORAL }} />
          <h1 className="text-2xl font-bold tracking-tight">Comment to DM</h1>
        </div>
        <p className="text-sm text-stone-600">
          Turn comments on your Instagram posts into qualified DMs.
          Two-step setup: pick which posts to watch, then write a DM template
          for each intent class.
        </p>
      </div>

      {silentFailure && (
        <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-4 md:p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              You&rsquo;re watching posts but haven&rsquo;t written any DM
              templates yet.
            </p>
            <p className="text-amber-800 mt-0.5">
              Clinchd is classifying comments, but without templates no DMs go
              out — every action gets queued for review. Finish step 2 below
              to start sending.
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <StepCard
          stepNumber={1}
          icon={MessageCircleReply}
          title="Pick posts to watch"
          description="Choose which Instagram posts Clinchd should watch. Every new comment on a watched post gets classified by intent."
          statLabel="posts watched"
          statValue={postsCount}
          isComplete={postsCount > 0}
          href="/comment-triggers"
          ctaLabel={postsCount > 0 ? "Manage posts" : "Pick posts"}
        />
        <StepCard
          stepNumber={2}
          icon={MessageSquare}
          title="Write DM templates"
          description="Define what Clinchd sends for each intent class. High intent gets your sales pitch, warm fans get a thank-you, hostile comments get ignored."
          statLabel="templates written"
          statValue={templatesCount}
          isComplete={templatesCount > 0}
          href="/dm-templates"
          ctaLabel={templatesCount > 0 ? "Edit templates" : "Write templates"}
        />
      </div>

      <div
        className="rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6 flex items-end justify-between gap-4"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-wide">
            Last 30 days
          </p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-stone-900">
            {dmsCount.toLocaleString()}
          </p>
          <p className="text-sm text-stone-500 mt-0.5">
            {dmsCount === 1 ? "DM sent" : "DMs sent"} from comments
          </p>
        </div>
        <Link
          href="/comment-to-dm/activity"
          className="text-sm font-semibold text-stone-600 hover:text-stone-900 inline-flex items-center gap-1 pb-1"
        >
          View activity <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function StepCard({
  stepNumber,
  icon: Icon,
  title,
  description,
  statLabel,
  statValue,
  isComplete,
  href,
  ctaLabel,
}) {
  return (
    <Link
      href={href}
      className="group rounded-[2rem] bg-white border border-stone-200 p-5 md:p-6 hover:border-stone-300 transition-all flex flex-col"
      style={{ boxShadow: CARD_SHADOW }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{
              backgroundColor: isComplete ? "#ecfdf5" : "#fff5f2",
              color: isComplete ? "#059669" : CORAL,
            }}
          >
            {isComplete ? <CheckCircle2 className="h-4 w-4" /> : stepNumber}
          </div>
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">
            Step {stepNumber}
          </span>
        </div>
        <Icon className="h-5 w-5 text-stone-300" />
      </div>

      <h2 className="mt-4 text-lg font-semibold text-stone-900">{title}</h2>
      <p className="mt-1.5 text-sm text-stone-600 leading-relaxed flex-1">
        {description}
      </p>

      <div className="mt-5 pt-4 border-t border-stone-100 flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold tracking-tight text-stone-900">
            {statValue}
          </p>
          <p className="text-xs text-stone-500">{statLabel}</p>
        </div>
        <span
          className="inline-flex items-center gap-1 text-sm font-semibold pb-0.5"
          style={{ color: CORAL }}
        >
          {ctaLabel} <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}
