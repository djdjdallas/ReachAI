import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBusinessEventAlert } from "@/lib/alerts/business-events";

export const dynamic = "force-dynamic";

// Founder signup alert. public.users rows are created by the
// handle_new_user() DB trigger (migrations/008_trial_on_signup.sql), so no
// app code ever observes the insert — email/password signups in particular
// never touch a server route (signUp, login, and onboarding completion are
// all client-side). /onboarding is the nearest app-level point that every
// new user passes through exactly once regardless of auth method: the OAuth
// callback redirects fresh users here, and middleware redirects any
// incomplete-onboarding dashboard request here. The auth app_metadata flag
// is the once-only claim (claim BEFORE send, so a crash can drop an alert
// but never spam). Any failure is logged and never blocks rendering.
async function maybeSendSignupAlert() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.app_metadata?.founder_signup_alerted) return;

    const admin = getSupabaseAdmin();
    const { error: claimError } = await admin.auth.admin.updateUserById(
      user.id,
      { app_metadata: { founder_signup_alerted: true } }
    );
    if (claimError) {
      console.error(
        "[onboarding-layout] signup alert claim failed:",
        claimError.message
      );
      return;
    }

    const { data: row } = await admin
      .from("users")
      .select("email, plan, subscription_status, created_at")
      .eq("id", user.id)
      .single();

    sendBusinessEventAlert("signup", {
      email: row?.email || user.email,
      provider: user.app_metadata?.provider || null,
      plan: row?.plan,
      subscriptionStatus: row?.subscription_status,
      createdAt: row?.created_at,
    }).catch(console.error);
  } catch (err) {
    console.error("[onboarding-layout] signup alert failed:", err?.message);
  }
}

export default async function OnboardingLayout({ children }) {
  await maybeSendSignupAlert();
  return <div className="min-h-screen bg-[#fafaf9] text-stone-900">{children}</div>;
}
