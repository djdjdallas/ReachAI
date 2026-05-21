import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canUseVoiceReplies } from "@/lib/plan";
import VoiceRepliesClient from "./VoiceRepliesClient";

export const metadata = {
  title: "Voice Replies · Clinchd",
  robots: { index: false, follow: false },
};

const CORAL = "#ff7e67";

export default async function VoiceRepliesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, email, plan, subscription_status, voice_replies_enabled")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseVoiceReplies(profile)) {
    return (
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <div
          className="rounded-[2rem] bg-white border border-stone-200 p-8 md:p-10"
          style={{ boxShadow: "0 1px 0 rgba(15,15,15,0.04)" }}
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Voice Replies are on the Unlimited plan
          </h1>
          <p className="mt-3 text-stone-600">
            Record short voice memos for each intent (warm leads, price
            objections, booking moments, and more) and the AI will send your
            voice in place of a text reply when it fits. Available on the
            Unlimited tier.
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
  const { data: snippets } = await admin
    .from("voice_snippets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <VoiceRepliesClient
      initialSnippets={snippets || []}
      killSwitchActive={profile?.voice_replies_enabled === false}
    />
  );
}
