#!/usr/bin/env node
//
// scripts/verify-inbound-fix.mjs
//
// Verifies the inbound-DM-misclassification fix after the migrations run.
//
// Two checks:
//   1. Blast radius — count conversations still miscategorized: origin
//      'clinchd_sent' + missing_outbound_context=true + first message is
//      inbound (role='user') + no matched native_send_outbound row. Must be 0.
//   2. The อัศวิน conversation (6e983f88-2e40-445c-a9b8-0eab48c5e2d4) must now
//      have origin='inbound' and missing_outbound_context=false. (ai_paused is
//      intentionally NOT asserted — the classifier pause is left in place for
//      manual review.)
//
// Exit 0 + "VERIFIED: 0 miscategorized conversations" when clean.
// Exit 1 + the offending conversation IDs when anything remains.
//
// Read-only. Mutates nothing.
//
// Required env (load via `node --env-file=.env.local scripts/...`):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node --env-file=.env.local scripts/verify-inbound-fix.mjs

import { createClient } from "@supabase/supabase-js";

const AISAWIN_CONVERSATION_ID = "6e983f88-2e40-445c-a9b8-0eab48c5e2d4";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function findMiscategorized() {
  // Candidates: still flagged outbound-missing-context. For each, confirm the
  // first message is inbound and there is no matched native_send (the exact
  // audit predicate). After the backfill this should return zero candidates.
  const { data: candidates, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("origin", "clinchd_sent")
    .eq("missing_outbound_context", true);

  if (error) {
    console.error("Blast-radius query failed:", error.message);
    process.exit(1);
  }

  const offenders = [];
  for (const c of candidates || []) {
    const { data: firstMsg } = await supabase
      .from("messages")
      .select("role")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstMsg?.role !== "user") continue; // outbound-first → legitimately outbound

    const { data: match } = await supabase
      .from("native_send_outbound")
      .select("id")
      .eq("matched_conversation_id", c.id)
      .limit(1)
      .maybeSingle();
    if (match) continue; // a real native cold-DM was logged → legitimately outbound

    offenders.push(c.id);
  }
  return offenders;
}

async function checkAisawin() {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, origin, missing_outbound_context, ai_paused")
    .eq("id", AISAWIN_CONVERSATION_ID)
    .maybeSingle();

  if (error) {
    console.error("อัศวิน lookup failed:", error.message);
    process.exit(1);
  }
  if (!data) {
    return { ok: false, detail: "conversation not found" };
  }
  const ok =
    data.origin === "inbound" && data.missing_outbound_context === false;
  return {
    ok,
    detail: `origin=${data.origin}, missing_outbound_context=${data.missing_outbound_context}, ai_paused=${data.ai_paused}`,
  };
}

async function main() {
  const offenders = await findMiscategorized();
  const aisawin = await checkAisawin();

  console.log(`Miscategorized conversations remaining: ${offenders.length}`);
  console.log(
    `อัศวิน conversation (${AISAWIN_CONVERSATION_ID}): ${aisawin.detail}`
  );

  if (offenders.length === 0 && aisawin.ok) {
    console.log("VERIFIED: 0 miscategorized conversations");
    process.exit(0);
  }

  if (offenders.length > 0) {
    console.error("Still miscategorized:");
    for (const id of offenders) console.error(`  - ${id}`);
  }
  if (!aisawin.ok) {
    console.error(
      `อัศวิน conversation did not reach the expected state (${aisawin.detail})`
    );
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("verify-inbound-fix failed:", err?.message || err);
  process.exit(1);
});
