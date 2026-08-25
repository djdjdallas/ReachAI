import { createClient } from "@/lib/supabase/client";

// Single sign-out path for every "Sign out" button and the account-deletion
// flow. Clears browser-scoped state that must not leak to the next account on
// this machine: middleware trusts the onboarding_completed cookie without
// checking whose it is, so a leftover "true" makes a fresh signup on the same
// browser (e.g. an affiliate's demo laptop) skip onboarding entirely and land
// on an empty dashboard.
export async function signOutAndClearState() {
  document.cookie = "onboarding_completed=; path=/; max-age=0; samesite=lax";
  const supabase = createClient();
  await supabase.auth.signOut();
}
