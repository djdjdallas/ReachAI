import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KnowledgeEditor from "./KnowledgeEditor";

export const metadata = {
  title: "Business Knowledge · Clinchd",
};

// Entries load client-side through /api/settings/knowledge, the same route
// every write goes through, so the page always shows what the server
// validated and stored.
export default async function KnowledgeSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <KnowledgeEditor />;
}
