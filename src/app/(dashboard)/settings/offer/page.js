import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OfferForm from "./OfferForm";

export const metadata = {
  title: "Your Offer · Clinchd",
};

export default async function OfferSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Most-recently-updated, non-deprecated offer is the active one. The
  // post_context_bundles join in src/lib/contextBundle.js follows the same
  // convention, so the form here is the source of truth that the classifier
  // ultimately sees.
  const { data: activeOffer } = await supabase
    .from("creator_offers")
    .select(
      "id, offer_name, offer_price_cents, offer_url, ideal_customer, objections, qualification_questions"
    )
    .eq("creator_id", user.id)
    .is("deprecated_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return <OfferForm initialOffer={activeOffer || null} />;
}
