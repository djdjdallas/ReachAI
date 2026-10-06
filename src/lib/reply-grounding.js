// Everything a reply prompt is grounded in, loaded the same way for every
// reply path (webhook, dashboard reply, playground, drip): the active
// creator_offers row and the enabled business knowledge entries. Pass the
// result straight into buildSystemPrompt's options.

import { getActiveOffer } from "./active-offer";
import { getKnowledgeEntries } from "./knowledge/load";

/**
 * @param {object} supabase
 * @param {string} userId
 * @returns {Promise<{activeOffer: object|null, knowledge: Array<object>}>}
 *   never rejects
 */
export async function loadReplyGrounding(supabase, userId) {
  const [activeOffer, knowledge] = await Promise.all([
    getActiveOffer(supabase, userId),
    getKnowledgeEntries(supabase, userId),
  ]);
  return { activeOffer, knowledge };
}
