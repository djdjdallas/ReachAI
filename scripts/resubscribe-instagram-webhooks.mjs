#!/usr/bin/env node
//
// scripts/resubscribe-instagram-webhooks.mjs
//
// One-off: re-issue the `/{igbaId}/subscribed_apps` POST for every already-
// connected Instagram Business Account so the new `comments` field is added
// to existing accounts. New connects pick up the field automatically via
// src/app/api/auth/instagram/callback/route.js.
//
// Required env (load via `node --env-file=.env.local scripts/...` or `dotenv`):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY    (service-role; bypasses RLS to read the token column)
//   INSTAGRAM_APP_ID             (informational only — Meta validates via the access token)
//   INSTAGRAM_APP_SECRET         (informational only)
//
// Usage:
//   node scripts/resubscribe-instagram-webhooks.mjs                    # live, all accounts
//   node scripts/resubscribe-instagram-webhooks.mjs --dry-run          # prints actions, no API calls
//   node scripts/resubscribe-instagram-webhooks.mjs --igba=17841400000000000
//       # live, ONLY the account with that Instagram Business Account ID
//
// Notes:
//  - This script decrypts `meta_page_access_token` the same way the runtime
//    does (src/lib/token-utils.js) and re-uses src/lib/instagram.js' subscribe
//    helper indirectly by hitting the same Graph endpoint. We do NOT import
//    from src/ because that pulls in Next.js bindings; instead we inline the
//    small bits we need.
//  - Failures are logged per-account but do not stop the run.

import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

// Mirrors REQUIRED_WEBHOOK_FIELDS in src/lib/instagram-webhook-fields.js —
// that module is the source of truth; keep this string in sync. Mirrored
// (not imported) because this standalone node script runs outside the
// app's module resolution and the package is CommonJS.
// `message_echoes` is deliberately absent: echoes arrive under `messages`
// with is_echo, and Meta 400s the whole POST on unknown fields (2026-09-07).
const SUBSCRIBED_FIELDS = "messages,messaging_postbacks,comments";
const GRAPH_BASE = "https://graph.instagram.com/v21.0";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const ONLY_IGBA = [...args].find((a) => a.startsWith("--igba="))?.slice(7) || null;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_ROLE = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const ENCRYPTION_KEY = requireEnv("ENCRYPTION_KEY");
// INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET aren't used by /subscribed_apps
// (the page access token is the auth), but we surface a warning if missing
// so callers know their env is incomplete.
if (!process.env.INSTAGRAM_APP_ID) console.warn("INSTAGRAM_APP_ID not set (informational)");
if (!process.env.INSTAGRAM_APP_SECRET) console.warn("INSTAGRAM_APP_SECRET not set (informational)");

// Mirrors src/lib/token-utils.js decryptToken (AES-256-GCM with hex IV+ciphertext+tag).
function decryptToken(encrypted) {
  if (!encrypted) return null;
  const key = Buffer.from(ENCRYPTION_KEY, "hex");
  const [ivHex, tagHex, dataHex] = encrypted.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("malformed encrypted token");
  }
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}

async function resubscribe(igbaId, accessToken) {
  const url = `${GRAPH_BASE}/${igbaId}/subscribed_apps`;
  const body = new URLSearchParams({
    subscribed_fields: SUBSCRIBED_FIELDS,
    access_token: accessToken,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    return { ok: false, status: res.status, error: data?.error?.message || `HTTP ${res.status}` };
  }
  return { ok: true, status: res.status, data };
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from("users")
    .select("id, email, instagram_business_account_id, meta_page_access_token")
    .not("instagram_business_account_id", "is", null);
  if (ONLY_IGBA) query = query.eq("instagram_business_account_id", ONLY_IGBA);
  const { data: rows, error } = await query;

  if (error) {
    console.error("Failed to query users:", error.message);
    process.exit(1);
  }

  console.log(
    `Found ${rows.length} connected Instagram accounts (${DRY_RUN ? "dry-run" : "live"})`
  );
  console.log(`Target fields: ${SUBSCRIBED_FIELDS}`);
  console.log("");

  let okCount = 0;
  let failCount = 0;

  for (const row of rows) {
    const label = `${row.email || row.id} (igba=${row.instagram_business_account_id})`;
    if (!row.meta_page_access_token) {
      console.warn(`SKIP  ${label} — no meta_page_access_token`);
      failCount += 1;
      continue;
    }

    let token;
    try {
      token = decryptToken(row.meta_page_access_token);
    } catch (err) {
      console.error(`FAIL  ${label} — decrypt failed: ${err.message}`);
      failCount += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`DRY   ${label} — would POST subscribed_apps`);
      okCount += 1;
      continue;
    }

    try {
      const res = await resubscribe(row.instagram_business_account_id, token);
      if (res.ok) {
        console.log(`OK    ${label}`);
        okCount += 1;
      } else {
        console.error(`FAIL  ${label} — ${res.error}`);
        failCount += 1;
      }
    } catch (err) {
      console.error(`FAIL  ${label} — threw: ${err?.message}`);
      failCount += 1;
    }
  }

  console.log("");
  console.log(`Done. ok=${okCount} fail=${failCount} total=${rows.length}`);
  if (failCount > 0) process.exit(2);
}

main().catch((err) => {
  console.error("Script crashed:", err);
  process.exit(1);
});
