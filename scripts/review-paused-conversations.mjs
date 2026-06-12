#!/usr/bin/env node
//
// scripts/review-paused-conversations.mjs
//
// Manual-review aid for the inbound-DM-misclassification fix.
//
// The backfill migration (20260604120100_backfill_inbound_origin) corrects
// inbound-initiated conversations from origin='clinchd_sent' to 'inbound' and
// clears their orange backfill banner, but DELIBERATELY does not unpause them.
// The do_not_send classifier pause is an independent system and may have been
// correct on some rows. This script lists every still-paused inbound thread so
// Dom can decide, per conversation, whether to manually unpause.
//
// It mutates NOTHING. Read-only.
//
// Required env (load via `node --env-file=.env.local scripts/...`):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY    (service-role; bypasses RLS to read across users)
//
// Usage:
//   node --env-file=.env.local scripts/review-paused-conversations.mjs

import { createClient } from "@supabase/supabase-js";

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

function mdEscape(s) {
  return String(s ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

async function main() {
  // The set Dom reviews: inbound-origin threads that are still AI-paused.
  // After the backfill these are exactly the rows it corrected (it left
  // ai_paused untouched), plus any future inbound thread the classifier pauses.
  const { data: convos, error } = await supabase
    .from("conversations")
    .select(
      "id, sender_name, origin, missing_outbound_context, ai_paused, ai_pause_reason, created_at"
    )
    .eq("origin", "inbound")
    .eq("ai_paused", true)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  if (!convos || convos.length === 0) {
    console.log("No paused inbound conversations to review.");
    return;
  }

  // For each, fetch the first inbound (role='user') message: snippet + signals.
  const rows = [];
  for (const c of convos) {
    const { data: firstMsg } = await supabase
      .from("messages")
      .select("content, intent_classification, created_at")
      .eq("conversation_id", c.id)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const snippet = (firstMsg?.content || "").slice(0, 100);
    const signals = firstMsg?.intent_classification?.signals;
    const signalsText = Array.isArray(signals) ? signals.join(", ") : "—";

    rows.push({
      id: c.id,
      sender_name: c.sender_name || "—",
      snippet,
      signals: signalsText,
      ai_pause_reason: c.ai_pause_reason || "—",
      created_at: c.created_at,
    });
  }

  console.log(`# Paused inbound conversations to review (${rows.length})\n`);
  console.log(
    "| Conversation ID | Sender | First inbound message (100 chars) | Classifier signals | Pause reason | Created |"
  );
  console.log("|---|---|---|---|---|---|");
  for (const r of rows) {
    console.log(
      `| ${r.id} | ${mdEscape(r.sender_name)} | ${mdEscape(r.snippet)} | ${mdEscape(
        r.signals
      )} | ${mdEscape(r.ai_pause_reason)} | ${mdEscape(r.created_at)} |`
    );
  }
  console.log(
    "\nTo unpause a reviewed conversation, do it from the Clinchd dashboard (or set ai_paused=false, ai_pause_reason=null on that row)."
  );
}

main().catch((err) => {
  console.error("review-paused-conversations failed:", err?.message || err);
  process.exit(1);
});
