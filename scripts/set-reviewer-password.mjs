// One-off script: set a password on the Meta reviewer test account.
// Run with: node --env-file=.env.local scripts/set-reviewer-password.mjs
// DELETE THIS FILE AFTER RUNNING.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const USER_ID = "15235d0b-9758-472c-8d11-040d8498a938"; // highflyinnick
const NEW_PASSWORD = "ClinchdReview2026!";

const { data, error } = await supabase.auth.admin.updateUserById(USER_ID, {
  password: NEW_PASSWORD,
});

if (error) {
  console.error("Failed to set password:", error.message);
  process.exit(1);
}

console.log("✓ Password set successfully");
console.log("");
console.log("Login credentials for Meta App Review submission:");
console.log("  URL:      https://clinchd.io/login");
console.log("  Email:   ", data.user.email);
console.log("  Password:", NEW_PASSWORD);
console.log("");
console.log("DELETE this script after copying the credentials:");
console.log("  rm scripts/set-reviewer-password.mjs");
