import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import TemplateEditor from "./TemplateEditor";
import PublicReplySection from "./PublicReplySection";

export const metadata = {
  title: "DM templates · Clinchd",
  robots: { index: false, follow: false },
};

const CORAL = "#ff7e67";

export default async function DmTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("plan, email, calendly_url, comment_public_reply_enabled")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseCommentToDM({ plan: profile?.plan, email: user.email })) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div
          className="rounded-[2rem] bg-white border border-stone-200 p-8 md:p-10"
          style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
        >
          <h1 className="text-3xl font-bold tracking-tight">
            DM templates are on the Unlimited plan
          </h1>
          <p className="mt-3 text-stone-600">
            Define the message Clinchd sends for each intent class — high
            intent gets your sales DM, warm fans get a thank-you, hostile
            comments get nothing. Available on the Unlimited tier.
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

  // Parallel: templates, active offer, most-recent comment for preview seed,
  // plus the public comment-reply pool.
  const [templatesRes, offerRes, latestCommentRes, replyTemplatesRes] = await Promise.all([
    admin
      .from("dm_templates")
      .select("intent_class, template")
      .eq("creator_id", user.id),
    admin
      .from("creator_offers")
      .select("offer_name")
      .eq("creator_id", user.id)
      .is("deprecated_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("comment_classifications")
      .select("ig_commenter_username, posts ( caption )")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("comment_reply_templates")
      .select("id, reply_text, is_active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const templates = {};
  for (const row of templatesRes.data || []) {
    if (row?.intent_class && typeof row.template === "string") {
      templates[row.intent_class] = row.template;
    }
  }

  const latestPostCaption =
    latestCommentRes.data?.posts?.caption ||
    latestCommentRes.data?.posts?.[0]?.caption ||
    null;

  const placeholderValues = {
    commenterName: latestCommentRes.data?.ig_commenter_username || "sarah_example",
    postCaption: latestPostCaption || "your latest post caption goes here…",
    commenterIsSample: !latestCommentRes.data?.ig_commenter_username,
    postCaptionIsSample: !latestPostCaption,
    offerName: offerRes.data?.offer_name || null,
    bookingLink: profile?.calendly_url || null,
  };

  return (
    <>
      <TemplateEditor
        initialTemplates={templates}
        placeholderValues={placeholderValues}
      />
      <div className="max-w-3xl mx-auto px-6 md:px-10 pb-10">
        <PublicReplySection
          initialEnabled={profile?.comment_public_reply_enabled === true}
          initialTemplates={replyTemplatesRes.data || []}
        />
      </div>
    </>
  );
}
