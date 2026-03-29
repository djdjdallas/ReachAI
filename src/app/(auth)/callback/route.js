import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCustomer } from "@/lib/stripe";

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
          await admin.from("users").insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || "",
            subscription_status: "trialing",
            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        // Create Stripe customer if not exists
        if (!existing?.stripe_customer_id) {
          try {
            const customer = await createCustomer(user.email, user.id);
            await admin
              .from("users")
              .update({ stripe_customer_id: customer.id })
              .eq("id", user.id);
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
