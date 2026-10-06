#!/usr/bin/env node
// Set up a managed account (one clinic location = one Clinchd account):
// billing, persona, booking link, treatment list, demo flag. All of these
// are server-only users columns (migration 20261009120000); the browser
// can't change them.
//
//   node --env-file=.env.production.local --import ./scripts/_ext-loader.mjs \
//     scripts/managed-account.mjs --user <id|email> [options] [--apply]
//
// Options (each optional; only the ones given change):
//   --managed true|false          billing_managed: access without Stripe
//   --plan base|unlimited          'unlimited' is needed for comment-to-DM and drips
//   --assistant-name "Katlynne"    AI assistant's name ("" clears)
//   --business-name "Solé Aesthetics"   the business the inbox belongs to ("" clears)
//   --holding-text "..."           handoff holding text override ("" clears);
//                                  validated like an AI reply (no em dashes etc.)
//   --booking-url https://...      booking link for booking_link_sent ("" clears;
//                                  falls back to calendly_url)
//   --treatments '<json>'          [{"key":"botox","match":["botox","tox"]}, ...] ("" clears)
//   --demo true|false              webhook_demo: allows --demo-booking
//   --demo-booking [conversation_id]   record a demo booking (emits
//                                  consultation_booked with data.demo = true)
//
// Without --apply it prints the change and exits.

import { createClient } from "@supabase/supabase-js";
import { resolveUser } from "../src/lib/outbound-webhooks/admin.js";
import { normalizeTreatmentCategories } from "../src/lib/outbound-webhooks/lead-capture.js";
import { cleanAssistantName, cleanBusinessName, validateHoldingText } from "../src/lib/persona.js";
import { parseDestinationUrl } from "../src/lib/outbound-webhooks/ssrf.js";

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const APPLY = has("apply");

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[name]) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const bool = (name) => {
  const v = opt(name);
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error(`--${name} must be true or false`);
};
const clearable = (v) => (v === "" ? null : v);

function buildPatch() {
  const patch = {};
  if (has("managed")) patch.billing_managed = bool("managed");
  if (has("demo")) patch.webhook_demo = bool("demo");
  if (has("plan")) {
    const plan = opt("plan");
    if (plan !== "base" && plan !== "unlimited") throw new Error("--plan must be base or unlimited");
    patch.plan = plan;
  }
  if (has("assistant-name")) {
    const v = clearable(opt("assistant-name"));
    if (v !== null && !cleanAssistantName(v)) throw new Error("--assistant-name: letters, spaces, . ' - only, up to 40 chars");
    patch.assistant_name = v === null ? null : cleanAssistantName(v);
  }
  if (has("business-name")) {
    const v = clearable(opt("business-name"));
    if (v !== null && !cleanBusinessName(v)) throw new Error("--business-name: up to 80 chars, no < > { } `");
    patch.business_name = v === null ? null : cleanBusinessName(v);
  }
  if (has("holding-text")) {
    const v = clearable(opt("holding-text"));
    if (v !== null) {
      const check = validateHoldingText(v);
      if (!check.ok) throw new Error(`--holding-text rejected: ${check.reason}`);
      patch.holding_text = check.text;
    } else patch.holding_text = null;
  }
  if (has("booking-url")) {
    const v = clearable(opt("booking-url"));
    if (v !== null) parseDestinationUrl(v); // https, no credentials
    patch.booking_url = v;
  }
  if (has("treatments")) {
    const v = clearable(opt("treatments"));
    if (v === null) patch.treatment_categories = null;
    else {
      let parsed;
      try {
        parsed = JSON.parse(v);
      } catch {
        throw new Error("--treatments must be JSON");
      }
      const clean = normalizeTreatmentCategories(parsed);
      if (!clean.length || clean.length !== (Array.isArray(parsed) ? parsed.length : -1)) {
        throw new Error('--treatments: an array of {"key": "botox", "match": ["botox", "tox"]}; keys are a-z 0-9 _ -, max 40 chars');
      }
      patch.treatment_categories = clean;
    }
  }
  return patch;
}

async function main() {
  const user = await resolveUser(db, opt("user"));
  const patch = buildPatch();
  const demoBooking = has("demo-booking");

  if (!Object.keys(patch).length && !demoBooking) {
    console.log(JSON.stringify(user, null, 2));
    return;
  }
  console.log(`account: ${user.email} (${user.id})`);
  if (Object.keys(patch).length) console.log("change:", JSON.stringify(patch, null, 2));
  if (demoBooking) console.log("plus: a demo booking");
  if (!APPLY) {
    console.log("DRY RUN. Re-run with --apply.");
    return;
  }

  if (Object.keys(patch).length) {
    const { data, error } = await db
      .from("users")
      .update(patch)
      .eq("id", user.id)
      .select("id, billing_managed, plan, assistant_name, business_name, holding_text, booking_url, treatment_categories, webhook_demo")
      .single();
    if (error) throw new Error(`update failed: ${error.message}`);
    console.log("saved:", JSON.stringify(data, null, 2));
  }

  if (demoBooking) {
    const { data: fresh } = await db.from("users").select("webhook_demo").eq("id", user.id).single();
    if (!fresh?.webhook_demo) throw new Error("--demo-booking needs --demo true on this account first");
    const convArg = opt("demo-booking");
    const conversationId = typeof convArg === "string" ? convArg : null;
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const { data, error } = await db
      .from("bookings")
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        source: "demo",
        status: "confirmed",
        event_name: "Demo consultation",
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`demo booking failed: ${error.message}`);
    console.log(`demo booking ${data.id} recorded; consultation_booked (demo) is queued if the webhook is enabled.`);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
