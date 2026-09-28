#!/usr/bin/env node
//
// scripts/review-dns-paused-threads.mjs
//
// Remediation aid for PR A (audits/dm-classifier-prompt-audit-2026-09-28.md).
// Classifier v1.0 used do_not_send as a catch-all for personal, off-topic and
// poor-fit messages, and every hit paused the thread indefinitely. This lists
// every thread still paused for a do_not_send reason and re-classifies its
// last few lead messages with the current classifier.
//
//   KEEP     — at least one recent lead message is still do_not_send
//   UNPAUSE  — none are; the pause was likely a v1.0 misfire
//   NO-DATA  — no lead messages left to re-check; not touched
//
// It mutates NOTHING. It prints a review table and the SQL to unpause the
// UNPAUSE rows, which Dom runs by hand after reading the table.
//
// Required env (load via --env-file=.env.local):
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
//
// Usage:
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/review-dns-paused-threads.mjs

import { createClient } from "@supabase/supabase-js";
import { classifyDMIntent, DM_INTENT_VERSION } from "../src/lib/dm-intent.js";

const DNS_PAUSE_REASONS = [
  "flagged_do_not_send",
  "hostile_or_refund",
  "flagged_coach_script",
  "prompt_injection",
  "crisis_signal",
];
const LEAD_MESSAGES_TO_CHECK = 3;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);
requireEnv("ANTHROPIC_API_KEY");

const oneLine = (s, n) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);

const { data: convos, error } = await supabase
  .from("conversations")
  .select("id, user_id, sender_name, ai_pause_reason, status")
  .eq("ai_paused", true)
  .in("ai_pause_reason", DNS_PAUSE_REASONS)
  .order("created_at", { ascending: true });
if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}
console.log(`${convos.length} threads paused for a do_not_send reason. Re-classifying with ${DM_INTENT_VERSION}...\n`);

const unpause = [];
for (const c of convos) {
  const [{ data: historyDesc }, { data: user }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, role, content, source, created_at")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("users").select("script_config").eq("id", c.user_id).single(),
  ]);
  const history = (historyDesc || []).reverse();
  const leadIdx = history
    .map((m, i) => (m.role === "user" ? i : -1))
    .filter((i) => i >= 0)
    .slice(-LEAD_MESSAGES_TO_CHECK);

  const verdicts = [];
  for (const i of leadIdx) {
    // Same window the webhook sees: newest 20 rows up to this message.
    const window = history.slice(Math.max(0, i - 19), i + 1);
    try {
      const r = await classifyDMIntent({
        messageText: history[i].content,
        recentMessages: window,
        scriptConfig: user?.script_config || {},
        offer: user?.script_config?.offer,
      });
      verdicts.push({ text: history[i].content, cls: r.class, conf: r.confidence, signals: r.signals });
    } catch (err) {
      verdicts.push({ text: history[i].content, cls: "error", conf: 0, signals: [err.message] });
    }
  }

  const stillDns = verdicts.some((v) => v.cls === "do_not_send");
  const errored = verdicts.some((v) => v.cls === "error");
  // NO-DATA: the thread has no lead messages left (deleted), so there is
  // nothing to re-check — left for the coach to decide.
  const decision =
    verdicts.length === 0 ? "NO-DATA" : stillDns || errored ? "KEEP" : "UNPAUSE";
  if (decision === "UNPAUSE") unpause.push(c.id);

  console.log(`${decision.padEnd(8)} ${c.id}  ${oneLine(c.sender_name || "—", 24)}  reason=${c.ai_pause_reason} status=${c.status}`);
  for (const v of verdicts) {
    console.log(`         ${v.cls.padEnd(15)} ${(v.conf ?? 0).toFixed(2)}  "${oneLine(v.text, 80)}"  [${(v.signals || []).join(", ")}]`);
  }
}

console.log(`\n${unpause.length} of ${convos.length} proposed for UNPAUSE.`);
if (unpause.length) {
  const ids = unpause.map((id) => `'${id}'`).join(",\n  ");
  console.log(`
-- Review the table above first. Run manually against prod (pwyzbsmxzxfaikfnoxxc).
-- Clears the pause only; leaves status alone (a coach may have set it).
update conversations
set ai_paused = false, ai_pause_reason = null
where ai_paused
  and ai_pause_reason in (${DNS_PAUSE_REASONS.map((r) => `'${r}'`).join(", ")})
  and id in (
  ${ids}
);`);
}
