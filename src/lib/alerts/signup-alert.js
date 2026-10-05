import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendBusinessEventAlert } from "@/lib/alerts/business-events";

// Founder signup alert. public.users rows are created by the
// handle_new_user() DB trigger, so no app code ever observes the insert;
// email/password signups in particular never touch a server route. Called
// from the layouts a new user passes through first: /choose-plan (with the
// card-required trial every new user lands there before Checkout) and
// /onboarding (legacy users already past the paywall).
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
export async function maybeSendSignupAlert() {
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
        "[signup-alert] signup alert claim failed:",
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
        // Release the claim so the next render retries.
        // Guarded on our own timestamp: if anything else touched the
        // column meanwhile, leave it alone.
        const { error: unclaimError } = await admin
          .from("users")
          .update({ founder_signup_alerted_at: null })
          .eq("id", user.id)
          .eq("founder_signup_alerted_at", nowIso);
        if (unclaimError) {
          console.error(
            "[signup-alert] signup alert un-claim failed:",
            unclaimError.message
          );
        }
      }
    });
  } catch (err) {
    console.error("[signup-alert] signup alert failed:", err?.message);
  }
}
