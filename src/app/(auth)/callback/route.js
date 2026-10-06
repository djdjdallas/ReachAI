import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ensureStripeCustomer } from "@/lib/billing/customer";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = getSupabaseAdmin();

        // Ensure user row exists (fallback if DB trigger didn't fire)
        const { data: existing } = await admin
          .from("users")
          .select("id, stripe_customer_id, onboarding_completed")
          .eq("id", user.id)
          .single();

        if (!existing) {
          // No trial here: like handle_new_user, a new row starts 'inactive'
          // (column default) and the 7-day trial comes from card-required
          // Stripe Checkout. This fallback used to grant a no-card trial.
          await admin.from("users").insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || "",
          });
          getPostHogClient().capture({
            distinctId: user.id,
            event: "user_signed_up",
            properties: { method: "google", email: user.email },
          });
        } else {
          getPostHogClient().capture({
            distinctId: user.id,
            event: "user_logged_in",
            properties: { method: "google" },
          });
        }

        // Every user gets a Stripe customer (the same helper email signups
        // use on the plan page). Best-effort: Checkout retries it.
        if (!existing?.stripe_customer_id) {
          try {
            await ensureStripeCustomer(admin, user);
          } catch (err) {
            console.error("Failed to create Stripe customer:", err);
          }
        }

        // Route based on onboarding status
        if (!existing?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
