import { redirect } from "next/navigation";

// This route exists to support direct links like /conversations/abc-123
// It redirects to the main conversations page with the thread query param
export default async function ConversationByIdPage({ params }) {
  const { id } = await params;
  redirect(`/conversations?thread=${id}`);
}
