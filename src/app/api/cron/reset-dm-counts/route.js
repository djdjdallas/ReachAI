import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("users")
      .update({
        dm_count_this_month: 0,
        dm_count_reset_at: new Date().toISOString(),
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Update all rows

    if (error) {
      console.error("Failed to reset DM counts:", error);
      return NextResponse.json(
        { error: "Failed to reset" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reset_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
