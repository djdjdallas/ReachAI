import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import { decryptToken } from "@/lib/token-utils";
import PostPicker from "./PostPicker";

export const metadata = {
  title: "Comment to DM · Clinchd",
  robots: { index: false, follow: false },
};

const CORAL = "#ff7e67";
const IG_GRAPH_BASE = "https://graph.instagram.com/v21.0";

async function fetchRecentMedia(accessToken) {
  const url =
    `${IG_GRAPH_BASE}/me/media` +
    `?fields=id,caption,media_type,thumbnail_url,media_url,permalink,timestamp` +
    `&limit=25` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    return { ok: false, error: data?.error?.message || `HTTP ${res.status}`, items: [] };
  }
  return { ok: true, items: Array.isArray(data?.data) ? data.data : [] };
}

export default async function CommentTriggersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("plan, email, instagram_business_account_id, meta_page_access_token")
    .eq("id", user.id)
    .maybeSingle();

  // Paywall: gate hides the picker UI behind a plan check. Founder bypass is
  // preserved by canUseCommentToDM so Dom can dogfood on his account.
  if (!canUseCommentToDM({ plan: profile?.plan, email: user.email })) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div
          className="rounded-[2rem] bg-white border border-stone-200 p-8 md:p-10"
          style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
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

  if (!profile?.instagram_business_account_id || !profile?.meta_page_access_token) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div className="rounded-[2rem] bg-white border border-stone-200 p-8 md:p-10">
          <h1 className="text-2xl font-bold">Connect Instagram first</h1>
          <p className="mt-2 text-stone-600">
            We need an Instagram Business account connected before you can
            pick posts to watch.
          </p>
          <div className="mt-6">
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-full bg-stone-900 text-white px-5 py-2.5 text-sm font-semibold"
            >
              Go to Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  let mediaItems = [];
  let mediaError = null;
  try {
    const accessToken = decryptToken(profile.meta_page_access_token);
    const result = await fetchRecentMedia(accessToken);
    if (result.ok) mediaItems = result.items;
    else mediaError = result.error;
  } catch (err) {
    mediaError = err?.message || "Failed to fetch posts.";
  }

  // Pull existing monitoring rows so we can render toggle state. Join via
  // posts table to map ig_media_id → enabled/actions_per_class.
  const admin = getSupabaseAdmin();
  const { data: postRows } = await admin
    .from("posts")
    .select(
      `
      id,
      ig_media_id,
      post_monitoring_settings ( enabled, actions_per_class )
    `
    )
    .eq("creator_id", user.id)
    .not("ig_media_id", "is", null);

  const monitoringByMediaId = {};
  for (const row of postRows || []) {
    if (!row?.ig_media_id) continue;
    const ms = Array.isArray(row.post_monitoring_settings)
      ? row.post_monitoring_settings[0]
      : row.post_monitoring_settings;
    if (ms) {
      monitoringByMediaId[row.ig_media_id] = {
        enabled: ms.enabled !== false,
        actions_per_class: ms.actions_per_class || null,
      };
    }
  }

  // Surface "no template written" warnings inline next to each per-intent
  // dropdown. Without this, picking "Send DM" for a class without a template
  // silently downgrades to queue_review at runtime via decideAction().
  const { data: templates } = await admin
    .from("dm_templates")
    .select("intent_class, body")
    .eq("creator_id", user.id);

  const templatesByClass = {};
  for (const t of templates || []) {
    if (!t?.intent_class) continue;
    templatesByClass[t.intent_class] =
      typeof t.body === "string" && t.body.trim().length > 0;
  }

  return (
    <PostPicker
      mediaItems={mediaItems}
      monitoringByMediaId={monitoringByMediaId}
      mediaError={mediaError}
      templatesByClass={templatesByClass}
    />
  );
}
