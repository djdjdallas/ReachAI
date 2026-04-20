import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";
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

  return <ClassifierPlayground />;
}
