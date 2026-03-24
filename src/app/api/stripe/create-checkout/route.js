import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCheckoutSession, createCustomer, PLANS } from "@/lib/stripe";

export async function POST(request) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json();

    // Validate plan ID against known plans (server-side only)
    const plan = PLANS[planId];
    if (!plan?.priceId) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    const priceId = plan.priceId;

    // Fetch user profile to check for existing Stripe customer
    const { data: userProfile, error: profileError } = await getSupabaseAdmin()
      .from("users")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    let customerId = userProfile.stripe_customer_id;

    if (!customerId) {
      const customer = await createCustomer(
        userProfile.email || user.email,
        user.id
      );
      customerId = customer.id;

      // Save Stripe customer ID
      await getSupabaseAdmin()
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    // Create checkout session
    const session = await createCheckoutSession(customerId, priceId, user.id);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Create checkout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
