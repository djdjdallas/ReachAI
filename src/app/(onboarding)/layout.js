import { after } from "next/server";
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
// incomplete-onboarding dashboard request here.
//
// Once-only is enforced by an ATOMIC conditional claim on
// users.founder_signup_alerted_at (same shape as flagMetaReconnect): only
// the render that flips NULL -> now() sends; concurrent renders match zero
// rows. Because the claim is race-safe, a FAILED send can release it for
// the next render to retry — zero-loss without any multi-send risk, which
// the old non-conditional app_metadata claim could not offer. The send
// itself runs in after() so it survives the response (a bare
// fire-and-forget promise dies when the function freezes, which silently
// lost the 2026-09-02 alert). Any failure is logged and never blocks
// rendering.
async function maybeSendSignupAlert() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("users")
      .update({ founder_signup_alerted_at: nowIso })
      .eq("id", user.id)
      .is("founder_signup_alerted_at", null)
      .select("email, plan, subscription_status, created_at");
    if (claimError) {
      console.error(
        "[onboarding-layout] signup alert claim failed:",
        claimError.message
      );
      return;
    }
    if (!claimed?.length) return; // already alerted (or lost the race)

    const row = claimed[0];
    after(async () => {
      const sent = await sendBusinessEventAlert("signup", {
        email: row?.email || user.email,
        provider: user.app_metadata?.provider || null,
        plan: row?.plan,
        subscriptionStatus: row?.subscription_status,
        createdAt: row?.created_at,
      });
      if (!sent) {
        // Release the claim so the next /onboarding render retries.
        // Guarded on our own timestamp: if anything else touched the
        // column meanwhile, leave it alone.
        const { error: unclaimError } = await admin
          .from("users")
          .update({ founder_signup_alerted_at: null })
          .eq("id", user.id)
          .eq("founder_signup_alerted_at", nowIso);
        if (unclaimError) {
          console.error(
            "[onboarding-layout] signup alert un-claim failed:",
            unclaimError.message
          );
        }
      }
    });
  } catch (err) {
    console.error("[onboarding-layout] signup alert failed:", err?.message);
  }
}

export default async function OnboardingLayout({ children }) {
  await maybeSendSignupAlert();
  return <div className="min-h-screen bg-[#fafaf9] text-stone-900">{children}</div>;
}
