import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";
// eslint-disable-next-line no-unused-vars
import { hasCommentToDM } from "@/lib/plans";
import ClassifierPlayground from "./ClassifierPlayground";

export const metadata = {
  title: "Intent Classifier (Shadow)",
  robots: { index: false, follow: false },
};

export default async function AdminClassifierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!isIntentClassifierEnabled(user.email)) {
    notFound();
  }

  // TODO(comment-to-DM gate): once Meta App Review approves
  // instagram_manage_comments and this feature un-shadows, enforce the
  // production plan gate here:
  //   const { data: profile } = await supabase
  //     .from("users").select("plan").eq("id", user.id).single();
  //   if (!hasCommentToDM(profile?.plan)) notFound();

  const { data: activeOffer } = await supabase
    .from("creator_offers")
    .select(
      "offer_name, offer_price_cents, offer_url, ideal_customer, objections, qualification_questions"
    )
    .eq("creator_id", user.id)
    .is("deprecated_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const visionEnabled =
    String(process.env.VISION_ENABLED || "").toLowerCase() === "true";

  return (
    <ClassifierPlayground
      savedOffer={activeOffer || null}
      visionEnabled={visionEnabled}
    />
  );
}
