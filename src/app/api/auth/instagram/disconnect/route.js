import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { disconnectAccount } from "@/lib/unipile";

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the user's Unipile account ID
    const { data: profile } = await supabase
      .from("users")
      .select("unipile_account_id")
      .eq("id", user.id)
      .single();

    // Disconnect from Unipile if we have an account ID
    if (profile?.unipile_account_id) {
      try {
        await disconnectAccount(profile.unipile_account_id);
      } catch (err) {
        console.warn("Failed to disconnect from Unipile:", err.message);
      }
    }

    // Clear the account ID from our DB regardless
    await supabase
      .from("users")
      .update({ unipile_account_id: null })
      .eq("id", user.id);

    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  } catch (error) {
    console.error("Disconnect error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
