// Leaf module, no imports. PostHog identity is the Supabase user id (uuid),
// on the client and on every server capture, with email as a person
// property. It used to be the email, and only the email/password signup and
// login forms ever identified, so Google sign-ins (most signups) browsed
// onboarding under anonymous ids and the funnel couldn't be joined.

/**
 * Identify the signed-in user once per browser identity.
 *
 * @param {object} posthog - posthog-js instance
 * @param {{id: string, email?: string}|null} user - Supabase auth user
 * @returns {boolean} true when identify was called
 */
export function identifyUser(posthog, user) {
  if (!posthog || !user?.id) return false;
  if (posthog.get_distinct_id?.() === user.id) return false;
  posthog.identify(user.id, user.email ? { email: user.email } : undefined);
  return true;
}
