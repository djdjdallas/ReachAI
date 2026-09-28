#!/usr/bin/env node
//
// scripts/replay-dm-intent.mjs
//
// Regression replay for the DM intent classifier (src/lib/dm-intent.js).
// Runs classifyDMIntent over two fixture sets and scores the labels against
// hand-assigned gold:
//
//   scripts/fixtures/dm-intent/gold-prod.json  — prod message IDs + accepted
//     labels. Message text and history are read from the DB at run time and
//     never written to the repo.
//   scripts/fixtures/dm-intent/synthetic.json  — hand-written edge cases.
//
// The gold is written against the TARGET taxonomy (with not_a_lead), so the
// current classifier's misses are the baseline the fixes are measured against.
// See audits/dm-classifier-prompt-audit-2026-09-28.md.
//
// A "critical" miss is one that changes whether the lead gets a reply:
//   - predicted do_not_send when gold doesn't accept it (wrongful hold/pause)
//   - gold is do_not_send-only and the prediction isn't (unscreened reply)
//   - gold only accepts no-reply classes and the prediction lets the AI reply
//     (the AI answers the owner's personal contact)
//
// It mutates NOTHING. DB access is read-only. Each run makes ~95 Haiku calls
// (well under $1).
//
// Required env (load via --env-file=.env.local):
//   ANTHROPIC_API_KEY
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (prod set only)
//
// Usage:
//   node --env-file=.env.local --import ./scripts/_ext-loader.mjs \
//     scripts/replay-dm-intent.mjs [--only=prod|synthetic] [--json=out.json] [--strict]
//
//   --strict  exit 1 if any critical miss (for use once the fixes land)

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { classifyDMIntent, DM_INTENT_MODEL, DM_INTENT_VERSION } from "../src/lib/dm-intent.js";

const FIXTURES = path.join(import.meta.dirname, "fixtures", "dm-intent");
const DNS = "do_not_send";
const CONCURRENCY = 4;

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function loadJson(file) {
  return JSON.parse(readFileSync(path.join(FIXTURES, file), "utf8"));
}

// Mirrors the webhook: newest 20 rows up to and including the inbound
// message, restored to chronological order, with source for speaker labels.
async function loadProdCases(gold) {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
  const cases = [];
  for (const row of gold.rows) {
    if (!row.accept) continue;
    const { data: target, error } = await supabase
      .from("messages")
      .select("id, content, created_at, conversation_id, intent_classification, conversations(user_id)")
      .eq("id", row.id)
      .single();
    if (error || !target) {
      console.warn(`skip ${row.id}: not found (${error?.code || "no row"})`);
      continue;
    }
    const [{ data: historyDesc }, { data: user }] = await Promise.all([
      supabase
        .from("messages")
        .select("role, content, source")
        .eq("conversation_id", target.conversation_id)
        .lte("created_at", target.created_at)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("users")
        .select("script_config")
        .eq("id", target.conversations.user_id)
        .single(),
    ]);
    cases.push({
      set: "prod",
      name: row.id.slice(0, 8),
      note: row.note,
      message: target.content,
      history: (historyDesc || []).reverse(),
      scriptConfig: user?.script_config || {},
      accept: row.accept,
      prodLabel: target.intent_classification?.class ?? null,
    });
  }
  return cases;
}

function loadSyntheticCases() {
  const { scriptConfig, cases } = loadJson("synthetic.json");
  return cases.map((c) => ({
    set: "synthetic",
    name: c.name,
    note: c.finding ? `audit ${c.finding}` : "",
    message: c.message,
    // The webhook's history already contains the new inbound row.
    history: [...c.history, { role: "user", source: "lead", content: c.message }],
    scriptConfig,
    accept: c.accept,
  }));
}

async function classify(c) {
  try {
    const r = await classifyDMIntent({
      messageText: c.message,
      recentMessages: c.history,
      scriptConfig: c.scriptConfig,
      offer: c.scriptConfig?.offer,
    });
    return { ...c, pred: r.class, conf: r.confidence, signals: r.signals, reasoning: r.reasoning };
  } catch (err) {
    return { ...c, pred: null, error: err.message };
  }
}

async function runPool(items, fn, n) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    })
  );
  return out;
}

// Classes that produce no AI reply for the turn (not_a_lead: no reply, no
// pause; do_not_send: hold, pause at >= threshold).
const NO_REPLY = [DNS, "not_a_lead"];

function score(r) {
  const correct = r.pred != null && r.accept.includes(r.pred);
  const wrongfulHold = r.pred === DNS && !r.accept.includes(DNS);
  const unscreened = r.accept.length === 1 && r.accept[0] === DNS && r.pred !== DNS;
  // Gold says "don't reply" (personal contact) but the label lets the AI reply.
  const unwantedReply =
    r.pred != null && r.accept.every((a) => NO_REPLY.includes(a)) && !NO_REPLY.includes(r.pred);
  const why = wrongfulHold
    ? "wrongful do_not_send"
    : unscreened
      ? "missed do_not_send"
      : unwantedReply
        ? "AI replies to personal contact"
        : "";
  return { ...r, correct, critical: wrongfulHold || unscreened || unwantedReply, why };
}

function report(results) {
  const truncate = (s, n) => (s || "").replace(/\s+/g, " ").slice(0, n);
  for (const set of ["prod", "synthetic"]) {
    const rs = results.filter((r) => r.set === set);
    if (!rs.length) continue;
    const correct = rs.filter((r) => r.correct).length;
    const critical = rs.filter((r) => r.critical);
    const errors = rs.filter((r) => r.error);
    console.log(`\n=== ${set}: ${correct}/${rs.length} correct (${((100 * correct) / rs.length).toFixed(0)}%), ${critical.length} critical, ${errors.length} errors ===`);
    for (const r of rs.filter((r) => !r.correct)) {
      const flag = r.critical ? "CRITICAL" : "miss    ";
      console.log(
        `${flag} ${r.name.padEnd(38)} pred=${String(r.pred).padEnd(15)} conf=${(r.conf ?? 0).toFixed(2)} want=${r.accept.join("|")}` +
          `\n         "${truncate(r.message, 90)}"  ${r.why || r.error || ""}  [${(r.signals || []).join(", ")}]`
      );
    }
    // Confusion on the primary gold label.
    const matrix = {};
    for (const r of rs) {
      const g = r.accept[0];
      matrix[g] ??= {};
      matrix[g][r.pred] = (matrix[g][r.pred] || 0) + 1;
    }
    console.log(`\n  primary gold → predictions`);
    for (const [g, preds] of Object.entries(matrix)) {
      console.log(`  ${g.padEnd(16)} ${Object.entries(preds).map(([p, n]) => `${p}:${n}`).join("  ")}`);
    }
  }
}

const cases = [];
if (args.only !== "synthetic") cases.push(...(await loadProdCases(loadJson("gold-prod.json"))));
if (args.only !== "prod") cases.push(...loadSyntheticCases());
requireEnv("ANTHROPIC_API_KEY");

console.log(`Replaying ${cases.length} cases on ${DM_INTENT_MODEL} (classifier ${DM_INTENT_VERSION})...`);
const results = (await runPool(cases, classify, CONCURRENCY)).map(score);
report(results);

if (args.json) {
  writeFileSync(args.json, JSON.stringify({ model: DM_INTENT_MODEL, version: DM_INTENT_VERSION, ranAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nWrote ${args.json} (contains message text; keep it out of the repo)`);
}
if (args.strict && results.some((r) => r.critical)) process.exitCode = 1;
