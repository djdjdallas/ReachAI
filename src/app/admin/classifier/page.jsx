import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
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

  const { data: profile } = await supabase
    .from("users")
    .select("plan, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!canUseCommentToDM({ plan: profile?.plan, email: user.email })) {
    notFound();
  }

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
