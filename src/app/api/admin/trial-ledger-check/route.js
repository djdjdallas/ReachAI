import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ADMIN_EMAIL } from "@/lib/featureFlags";
import { trialLedgerKey, trialLedgerSecretFingerprint } from "@/lib/billing/trial-policy";

export const dynamic = "force-dynamic";

// GET /api/admin/trial-ledger-check?email=<seeded email>   (admin only)
//
// Post-deploy check that PRODUCTION's TRIAL_LEDGER_SECRET matches the one
// the seed script used. It hashes with this deployment's secret and looks
// the row up: found = the secrets match. Also returns the secret
// fingerprint to compare with the seed script's output. A mismatch means
// every existing user would silently get a second trial.
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const email = new URL(request.url).searchParams.get("email");
  let key;
  try {
    key = trialLedgerKey(email);
  } catch (err) {
    return NextResponse.json({ error: err.message, fingerprint: null }, { status: 500 });
  }
  if (!key) return NextResponse.json({ error: "Pass ?email=<a seeded email>" }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("billing_trial_ledger")
    .select("source")
    .eq("email_hash", key)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    found: !!data,
    source: data?.source || null,
    fingerprint: trialLedgerSecretFingerprint(),
  });
}
