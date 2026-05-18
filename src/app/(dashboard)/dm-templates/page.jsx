import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import TemplateEditor from "./TemplateEditor";

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
    .select("plan, email")
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
  const { data: rows } = await admin
    .from("dm_templates")
    .select("intent_class, template")
    .eq("creator_id", user.id);

  const templates = {};
  for (const row of rows || []) {
    if (row?.intent_class && typeof row.template === "string") {
      templates[row.intent_class] = row.template;
    }
  }

  return <TemplateEditor initialTemplates={templates} />;
}
