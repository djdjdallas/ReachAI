#!/usr/bin/env node
//
// scripts/test-instagram-comment-webhook.mjs
//
// POSTs a synthetic Instagram comment webhook to the local dev server.
// Uses the dev-bypass header (Phase 1: WEBHOOK_DEV_BYPASS_TOKEN) so the
// HMAC check passes without computing a real Meta signature.
//
// Required env (use `node --env-file=.env.local scripts/...` or export
// manually):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   WEBHOOK_DEV_BYPASS_TOKEN
//
// Usage:
//   node scripts/test-instagram-comment-webhook.mjs \
//        --creator-email dominickjerell@gmail.com \
//        --post-id 18000000000000000 \
//        --comment-text "how much is this?" \
//        --commenter-username testlead
//
// Defaults to a HIGH_INTENT-looking comment from a synthetic user against
// a synthetic post id. The script does NOT create a posts row — if you
// want the webhook to actually classify and (optionally) dispatch, you
// must have first enabled monitoring on a real Instagram media id via
// the /comment-triggers UI, then pass that same ig_media_id as --post-id.

import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const BYPASS_TOKEN = requireEnv("WEBHOOK_DEV_BYPASS_TOKEN");

const targetUrl =
  args["url"] || process.env.WEBHOOK_TEST_URL || "http://localhost:3000/api/webhooks/instagram";
const creatorEmail = args["creator-email"] || "dominickjerell@gmail.com";
const postId = args["post-id"] || `sim_${Date.now()}_post`;
const commentText = args["comment-text"] || "how much is this? i'm ready to join";
const commenterUsername = args["commenter-username"] || "testlead_clinchd";
const commentIdArg =
  args["comment-id"] || `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. Look up the creator's IGBA so the entry.id matches what the webhook
//    handler expects (it joins on users.instagram_business_account_id).
const { data: ownerUser, error: lookupErr } = await supabase
  .from("users")
  .select("id, email, instagram_business_account_id")
  .eq("email", creatorEmail)
  .maybeSingle();

if (lookupErr) {
  console.error("user lookup failed:", lookupErr.message);
  process.exit(1);
}
if (!ownerUser) {
  console.error(`no user found with email ${creatorEmail}`);
  process.exit(1);
}
if (!ownerUser.instagram_business_account_id) {
  console.error(`user ${creatorEmail} has no instagram_business_account_id set`);
  process.exit(1);
}

// 2. Construct a payload shaped exactly like Meta's real comment webhook.
//    Schema reference: https://developers.facebook.com/docs/instagram-platform/webhooks
const payload = {
  object: "instagram",
  entry: [
    {
      id: ownerUser.instagram_business_account_id,
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: "comments",
          value: {
            id: commentIdArg,
            from: {
              id: `igsid_${commenterUsername}`,
              username: commenterUsername,
            },
            media: { id: postId, media_product_type: "FEED" },
            text: commentText,
            parent_id: null,
            created_time: Math.floor(Date.now() / 1000),
          },
        },
      ],
    },
  ],
};

console.log("→ POST", targetUrl);
console.log("→ creator:", creatorEmail, `(igba=${ownerUser.instagram_business_account_id})`);
console.log("→ comment_id:", commentIdArg);
console.log("→ post_id:", postId);
console.log("→ payload:", JSON.stringify(payload, null, 2));
console.log("");

let res;
try {
  res = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-clinchd-dev-bypass": BYPASS_TOKEN,
    },
    body: JSON.stringify(payload),
  });
} catch (err) {
  console.error("fetch failed:", err.message);
  console.error("Is the dev server running on", targetUrl, "?");
  process.exit(1);
}

const responseText = await res.text();
console.log(`← HTTP ${res.status}`);
console.log(`← body: ${responseText}`);
console.log("");

// 3. Wait a beat so the async classifier writes land, then read back the
//    most recent classification + log row so the simulator is a one-shot
//    verification command.
await new Promise((r) => setTimeout(r, 1500));

const { data: cls } = await supabase
  .from("comment_classifications")
  .select(
    "id, ig_comment_id, ig_commenter_username, class, confidence, reasoning, classified_at"
  )
  .eq("creator_id", ownerUser.id)
  .order("classified_at", { ascending: false })
  .limit(1);

const { data: log } = await supabase
  .from("comment_to_dm_log")
  .select(
    "id, decided_action, rendered_dm, dispatched, dispatched_at, dispatched_message_id, dispatch_error, dispatch_retryable, simulated_at"
  )
  .eq("creator_id", ownerUser.id)
  .order("simulated_at", { ascending: false })
  .limit(1);

console.log("most recent comment_classifications row:");
console.log(JSON.stringify(cls?.[0] || null, null, 2));
console.log("");
console.log("most recent comment_to_dm_log row:");
console.log(JSON.stringify(log?.[0] || null, null, 2));
