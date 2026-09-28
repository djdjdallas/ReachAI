// The coach's active offer: their most recently updated creator_offers row
// that hasn't been deprecated. Used by every reply path (webhook, dashboard
// reply, playground, drip) to ground prices and links in the system prompt.
// Other features (settings, comment-to-DM, classifier playground) still run
// the same query inline.

const OFFER_FIELDS =
  "offer_name, offer_price_cents, offer_url, ideal_customer, objections";

/**
 * @param {object} supabase - a Supabase client that can read creator_offers
 * @param {string} userId
 * @returns {Promise<object|null>} null when there's no offer or the read fails
 *   (grounding is best-effort; a reply must never fail on it)
 */
export async function getActiveOffer(supabase, userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("creator_offers")
      .select(OFFER_FIELDS)
      .eq("creator_id", userId)
      .is("deprecated_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[active-offer] read failed:", error.code);
      return null;
    }
    return data || null;
  } catch (err) {
    console.warn("[active-offer] read threw:", err?.message);
    return null;
  }
}

/**
 * The account owner as the prompt's identity rules need it.
 *
 * @param {{full_name?: string, instagram_username?: string}} user
 * @returns {{name: string, igHandle: string}}
 */
export function ownerFromUser(user) {
  return {
    name: user?.full_name || "",
    igHandle: user?.instagram_username || "",
  };
}
