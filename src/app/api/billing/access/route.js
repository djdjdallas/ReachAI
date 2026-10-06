import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { accessDecision } from "@/lib/billing/access";
import { ACCESS_COLUMNS } from "@/lib/billing/status";

export const dynamic = "force-dynamic";

// GET /api/billing/access: the server's access decision for the signed-in
// user, for UI only (TrialExpiredGate, banners). Browser code never
// computes access itself; every real gate (middleware, send paths, feature
// APIs) calls hasActiveAccess on the server.
//
// trialEndsAt is returned only for a legacy no-card trial that still has
// access, so the UI can show "your trial ends in N days".
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await getSupabaseAdmin()
    .from("users")
    .select(ACCESS_COLUMNS)
    .eq("id", user.id)
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "profile_unavailable" }, { status: 500 });
  }

  const decision = accessDecision(row);
  return NextResponse.json({
    hasAccess: decision.hasAccess,
    kind: decision.kind,
    reason: decision.reason,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: decision.kind === "legacy_trial" && decision.hasAccess ? row.trial_ends_at : null,
  });
}
