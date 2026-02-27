import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCustomerPortalSession } from "@/lib/stripe";

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

    // Fetch user profile to get Stripe customer ID
    const { data: userProfile, error: profileError } = await getSupabaseAdmin()
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    if (!userProfile.stripe_customer_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    // Create portal session
    const session = await createCustomerPortalSession(
      userProfile.stripe_customer_id
    );

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    console.error("Create portal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
