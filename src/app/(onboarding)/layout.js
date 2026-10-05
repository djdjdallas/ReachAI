import { maybeSendSignupAlert } from "@/lib/alerts/signup-alert";

export const dynamic = "force-dynamic";

export default async function OnboardingLayout({ children }) {
  await maybeSendSignupAlert();
  return <div className="min-h-screen bg-[#fafaf9] text-stone-900">{children}</div>;
}
