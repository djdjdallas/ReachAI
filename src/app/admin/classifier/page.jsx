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

  return <ClassifierPlayground />;
}
