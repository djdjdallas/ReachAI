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

    const { data: profile } = await supabase
      .from("users")
      .select("unipile_account_id, instagram_business_account_id")
      .eq("id", user.id)
      .single();

    // Disconnect from Unipile if legacy connection
    if (profile?.unipile_account_id) {
      try {
        await disconnectAccount(profile.unipile_account_id);
      } catch (err) {
        console.warn("Failed to disconnect from Unipile:", err.message);
      }
    }

    // Clear all connection fields
    await supabase
      .from("users")
      .update({
        unipile_account_id: null,
        instagram_business_account_id: null,
        meta_page_id: null,
        meta_page_access_token: null,
        meta_user_access_token: null,
        meta_token_expires_at: null,
      })
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
