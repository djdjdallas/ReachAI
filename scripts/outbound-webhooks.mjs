#!/usr/bin/env node
// Admin tool for outbound lifecycle webhooks (docs/outbound-webhooks.md).
// Run locally with the service role; there is no HTTP admin surface.
//
//   node --env-file=.env.production.local --import ./scripts/_ext-loader.mjs \
//     scripts/outbound-webhooks.mjs <command> [options]
//
// Commands:
//   show     --user <id|email>                       config (never the secret) + recent deliveries
//   create   --user <id|email> --url <https url> [--events a,b,c] [--enable] --apply
//            prints the signing secret ONCE
//   set-url  --user <id|email> --url <https url> --apply
//   events   --user <id|email> --events a,b,c --apply
//   enable   --user <id|email> --apply
//   disable  --user <id|email> --apply
//   rotate   --user <id|email> --apply              prints the new secret ONCE
//   test     --user <id|email> --apply [--now]       queues a test event; --now
//                                                    also runs one delivery pass here
//   replay   --event evt_<uuid> --apply [--now]      same id, same body, fresh signature
//
// Without --apply, write commands only say what they would do.
//
// ENCRYPTION_KEY must be production's (vercel env pull), or production
// can't decrypt the secret: the first test event then fails with
// secret_unreadable (check with `show`). Never paste the printed secret
// anywhere but the receiver's config.

import { createClient } from "@supabase/supabase-js";
import {
  createWebhook,
  enqueueTestEvent,
  getWebhook,
  parseEventTypes,
  replayEvent,
  resolveUser,
  rotateSecret,
  updateWebhook,
  webhookStatus,
} from "../src/lib/outbound-webhooks/admin.js";
import { runOutboundDelivery } from "../src/lib/outbound-webhooks/deliver.js";

const argv = process.argv.slice(2);
const command = argv[0];
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};
const APPLY = argv.includes("--apply");

for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY"]) {
  if (!process.env[name]) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const dry = (what) => {
  console.log(`DRY RUN: would ${what}. Re-run with --apply.`);
  process.exit(0);
};

const printSecretOnce = (secret) => {
  console.log("\nSigning secret (shown once, store it in the receiver now):\n");
  console.log(`  ${secret}\n`);
};

async function main() {
  switch (command) {
    case "show": {
      const user = await resolveUser(db, opt("user"));
      const hook = await getWebhook(db, user.id);
      console.log(JSON.stringify({ user: { id: user.id, email: user.email, business_name: user.business_name }, webhook: hook }, null, 2));
      console.log(JSON.stringify(await webhookStatus(db, user.id), null, 2));
      return;
    }
    case "create": {
      const user = await resolveUser(db, opt("user"));
      const url = opt("url");
      if (typeof url !== "string") throw new Error("--url is required");
      const eventTypes = parseEventTypes(opt("events"));
      const enabled = argv.includes("--enable");
      if (!APPLY) dry(`create a ${enabled ? "enabled" : "disabled"} webhook for ${user.email} -> ${url} (${eventTypes.join(", ")})`);
      const { webhook, secret } = await createWebhook(db, { userId: user.id, url, eventTypes, enabled });
      console.log(JSON.stringify(webhook, null, 2));
      printSecretOnce(secret);
      return;
    }
    case "set-url":
    case "events":
    case "enable":
    case "disable": {
      const user = await resolveUser(db, opt("user"));
      const patch = {};
      if (command === "set-url") {
        if (typeof opt("url") !== "string") throw new Error("--url is required");
        patch.url = opt("url");
      }
      if (command === "events") patch.eventTypes = parseEventTypes(opt("events"));
      if (command === "enable") patch.enabled = true;
      if (command === "disable") patch.enabled = false;
      if (!APPLY) dry(`update ${user.email}'s webhook: ${JSON.stringify(patch)}`);
      console.log(JSON.stringify(await updateWebhook(db, user.id, patch), null, 2));
      return;
    }
    case "rotate": {
      const user = await resolveUser(db, opt("user"));
      if (!APPLY) dry(`rotate ${user.email}'s signing secret (the old one stops working immediately)`);
      printSecretOnce(await rotateSecret(db, user.id));
      return;
    }
    case "test": {
      const user = await resolveUser(db, opt("user"));
      const hook = await getWebhook(db, user.id);
      if (!hook) throw new Error("this account has no webhook");
      if (!hook.enabled) console.warn("Warning: the webhook is disabled; the test will be marked failed (webhook_disabled).");
      if (!APPLY) dry(`queue a test event for ${user.email}`);
      const id = await enqueueTestEvent(db, user.id);
      console.log(`queued ${id}`);
      if (argv.includes("--now")) console.log(JSON.stringify(await runOutboundDelivery(db)));
      else console.log("The cron delivers it within a minute. Check with: show --user ...");
      return;
    }
    case "replay": {
      const eventId = opt("event");
      if (typeof eventId !== "string") throw new Error("--event evt_<uuid> is required");
      if (!APPLY) dry(`replay ${eventId}`);
      console.log(`replaying ${await replayEvent(db, eventId)}`);
      if (argv.includes("--now")) console.log(JSON.stringify(await runOutboundDelivery(db)));
      return;
    }
    default:
      console.error("Usage: outbound-webhooks.mjs <show|create|set-url|events|enable|disable|rotate|test|replay> [options] (see the header)");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
