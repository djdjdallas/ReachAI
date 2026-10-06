// Every user gets a Stripe customer, whatever the signup method. Google
// signups used to get one in /callback; email signups only at Checkout.
// Server-side only (Stripe secret key).

import { createCustomer } from "@/lib/stripe";

/**
 * Return the user's Stripe customer id, creating the customer if needed.
 * The DB write only claims an empty slot (stripe_customer_id IS NULL), so
 * two concurrent calls can't overwrite each other; the loser re-reads.
 *
 * @param {object} admin - service-role Supabase client
 * @param {{id: string, email: string}} authUser
 * @returns {Promise<string>} the stripe_customer_id
 */
export async function ensureStripeCustomer(admin, authUser) {
  const { data: row, error } = await admin
    .from("users")
    .select("stripe_customer_id, email")
    .eq("id", authUser.id)
    .single();
  if (error) throw error;
  if (row?.stripe_customer_id) return row.stripe_customer_id;

  const customer = await createCustomer(row?.email || authUser.email, authUser.id);
  const { data: claimed, error: claimError } = await admin
    .from("users")
    .update({ stripe_customer_id: customer.id })
    .eq("id", authUser.id)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id");
  if (claimError) throw claimError;
  if (claimed?.length) return customer.id;

  // Lost a race: another request stored a customer first. Use theirs.
  const { data: again, error: againError } = await admin
    .from("users")
    .select("stripe_customer_id")
    .eq("id", authUser.id)
    .single();
  if (againError) throw againError;
  return again.stripe_customer_id;
}
