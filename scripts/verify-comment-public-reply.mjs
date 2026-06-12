#!/usr/bin/env node
//
// scripts/verify-comment-public-reply.mjs
//
// Verifies the default state of the public comment-reply feature after
// migration 20260612120000_comment_public_reply.sql runs:
//
//   1. Default OFF — zero users with comment_public_reply_enabled = true.
//      (Run BEFORE anyone opts in; after launch this check reports the
//      opt-in count instead of failing.)
//   2. No NULLs — every users row has a boolean value (NOT NULL holds).
//   3. No seeded templates — comment_reply_templates is empty at migration
//      time, and post_monitoring_settings.last_public_reply_text is NULL
//      everywhere (no reply has ever been posted).
//
// Exit 0 + "VERIFIED" when the default state is clean.
// Exit 1 with details when anything is unexpectedly on/seeded.
//
// Read-only. Mutates nothing.
//
// Required env (load via `node --env-file=.env.local scripts/...`):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//
// Usage:
//   node --env-file=.env.local scripts/verify-comment-public-reply.mjs

import { createClient } from "@supabase/supabase-js";

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

let failed = false;

// 1. Default OFF for every user.
const { count: enabledCount, error: enabledErr } = await supabase
  .from("users")
  .select("id", { count: "exact", head: true })
  .eq("comment_public_reply_enabled", true);

if (enabledErr) {
  console.error("users check failed (column missing? migration not run?):", enabledErr.message);
  process.exit(1);
}
if (enabledCount > 0) {
  console.warn(`${enabledCount} user(s) have comment_public_reply_enabled = true.`);
  console.warn("Expected 0 at migration time. If users have since opted in, this is fine.");
  failed = true;
} else {
  console.log("OK: 0 users with comment_public_reply_enabled = true");
}

// 2. NOT NULL holds (belt-and-braces — the constraint should make this 0).
const { count: nullCount, error: nullErr } = await supabase
  .from("users")
  .select("id", { count: "exact", head: true })
  .is("comment_public_reply_enabled", null);

if (nullErr) {
  console.error("NULL check failed:", nullErr.message);
  process.exit(1);
}
if (nullCount > 0) {
  console.error(`FAIL: ${nullCount} user(s) have NULL comment_public_reply_enabled`);
  failed = true;
} else {
  console.log("OK: no NULL comment_public_reply_enabled values");
}

// 3a. No seeded templates.
const { count: templateCount, error: tplErr } = await supabase
  .from("comment_reply_templates")
  .select("id", { count: "exact", head: true });

if (tplErr) {
  console.error("comment_reply_templates check failed (table missing?):", tplErr.message);
  process.exit(1);
}
if (templateCount > 0) {
  console.warn(`${templateCount} comment_reply_templates row(s) exist.`);
  console.warn("Expected 0 at migration time. If users have since added replies, this is fine.");
  failed = true;
} else {
  console.log("OK: comment_reply_templates is empty (nothing seeded)");
}

// 3b. No last-reply text recorded anywhere yet.
const { count: lastReplyCount, error: lastErr } = await supabase
  .from("post_monitoring_settings")
  .select("id", { count: "exact", head: true })
  .not("last_public_reply_text", "is", null);

if (lastErr) {
  console.error("post_monitoring_settings check failed (column missing?):", lastErr.message);
  process.exit(1);
}
if (lastReplyCount > 0) {
  console.warn(`${lastReplyCount} post(s) have a last_public_reply_text recorded.`);
  failed = true;
} else {
  console.log("OK: no last_public_reply_text recorded on any post");
}

if (failed) {
  console.log("\nDONE WITH WARNINGS — see above (expected if run after launch).");
  process.exit(1);
}
console.log("\nVERIFIED: default-off, nothing seeded.");
process.exit(0);
