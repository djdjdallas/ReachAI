import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseDripSequences } from "@/lib/plan";
import DripSequencesClient from "./DripSequencesClient";

export const metadata = {
  title: "Follow-up Nudges · Clinchd",
  robots: { index: false, follow: false },
};

const CORAL = "#ff7e67";

export default async function DripSequencesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, plan, subscription_status, drip_enabled, drip_delay_hours")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseDripSequences(profile)) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div
          className="rounded-[2rem] bg-white border border-stone-200 p-8 md:p-10"
          style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Follow-up Nudges are on the Unlimited plan
          </h1>
          <p className="mt-3 text-stone-600">
            Send a personal follow-up if your lead goes quiet before Instagram&apos;s
            24-hour window closes. One nudge per conversation, routed by intent.
            Available on the Unlimited tier.
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
  const { data: templates } = await admin
    .from("dm_drip_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <DripSequencesClient
      initialSettings={{
        drip_enabled: profile?.drip_enabled === true,
        drip_delay_hours: profile?.drip_delay_hours ?? 18,
      }}
      initialTemplates={templates || []}
    />
  );
}
