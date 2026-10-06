// First-message AI disclosure for persona accounts (users.business_name
// set). The server, not the model or the clinic's template, prepends
//   "Hi! I'm Katlynne, Solé Aesthetics' AI concierge."
// to the first assistant message actually sent in a conversation: the
// inbound reply, the comment-to-DM opener, a dashboard AI reply, or a drip
// nudge when that happens to be the first thing sent. Coach accounts (no
// business_name) are unchanged.
//
// Who discloses is decided by an explicit, server-only claim, never by
// reading message text: conversations.disclosed_at is set atomically
// (update ... where disclosed_at is null returning) right before a send.
// Only the caller that wins the claim prepends; if its send fails it
// releases the claim, so the next send discloses. Two concurrent replies
// disclose once.
//
// Send paths:
//   const prepared = await prepareFirstMessage(admin, user, text, { conversationId });
//   ... save and send prepared.text ...
//   if (!sent) await releaseFirstMessage(admin, prepared.claim);
// With no conversation yet (a comment-to-DM opener to a brand-new lead)
// nothing can have been sent to this lead, so the text is disclosed and
// claim.pendingInsert tells the caller to create the conversation with
// disclosed_at set.

import { cleanAssistantName, cleanBusinessName } from "./persona";

/** "Solé Aesthetics" → "Solé Aesthetics'", "Glow Spa" → "Glow Spa's". */
export function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** The disclosure line for an account, or null (not a persona account). */
export function disclosureLine(user) {
  const business = cleanBusinessName(user?.business_name);
  if (!business) return null;
  const name = cleanAssistantName(user?.assistant_name);
  return name ? `Hi! I'm ${name}, ${possessive(business)} AI concierge.` : `Hi! I'm ${possessive(business)} AI concierge.`;
}

// A leading greeting followed by punctuation ("Hey!", "Hi there,", "Hello.")
// and an optional wave. "Hi Jane!" is left alone: stripping would orphan the
// name.
const LEADING_GREETING_RE = /^\s*(?:hey there|hi there|hello there|hey|hi|hello|hiya|heya)\s*[!.,]+\s*(?:👋\s*)*/i;

/** Drop a leading greeting so the disclosure's "Hi!" isn't doubled. */
export function stripLeadingGreeting(text) {
  const s = String(text ?? "");
  const out = s.replace(LEADING_GREETING_RE, "");
  return out === s ? s : out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * The text with the disclosure line in front (leading greeting removed).
 * The only skip is text that already contains the exact line: mentioning
 * "AI" is not a disclosure ("Yes, our AI skin scan..." still gets it).
 */
export function applyDisclosure(text, line) {
  const s = String(text ?? "").trim();
  if (!line || s.includes(line)) return s;
  const rest = stripLeadingGreeting(s).trim();
  return rest ? `${line} ${rest}` : line;
}

/**
 * Whether the next message to this conversation is due the disclosure (no
 * claim yet). For gating before any claim (e.g. skip a voice memo on that
 * turn); the claim itself is what decides who prepends.
 */
export function disclosurePending(user, conversation) {
  return Boolean(disclosureLine(user)) && !conversation?.disclosed_at;
}

/**
 * Claim the disclosure for a conversation. Atomic: exactly one concurrent
 * caller gets the row back.
 *
 * @returns {Promise<{claimed: boolean, at: string|null, error: boolean}>}
 */
export async function claimDisclosure(admin, conversationId) {
  try {
    const { data, error } = await admin
      .from("conversations")
      .update({ disclosed_at: new Date().toISOString() })
      .eq("id", conversationId)
      .is("disclosed_at", null)
      .select("id, disclosed_at");
    if (error) return { claimed: false, at: null, error: true };
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { claimed: true, at: row.disclosed_at, error: false } : { claimed: false, at: null, error: false };
  } catch {
    return { claimed: false, at: null, error: true };
  }
}

/**
 * The text to save and send, plus the claim to release if the send fails.
 * Never throws.
 *
 * A claim that errors (the database couldn't answer) errs toward
 * disclosing: the text is disclosed with no claim to release.
 *
 * @param {object} admin - service-role client
 * @param {object} user - users row (business_name, assistant_name)
 * @param {string} text
 * @param {{conversationId?: string|null}} opts - null: no conversation yet
 * @returns {Promise<{text: string, claim: null | {conversationId: string, at: string} | {pendingInsert: true}}>}
 */
export async function prepareFirstMessage(admin, user, text, { conversationId = null } = {}) {
  const line = disclosureLine(user);
  if (!line) return { text, claim: null };
  if (!conversationId) return { text: applyDisclosure(text, line), claim: { pendingInsert: true } };
  const result = await claimDisclosure(admin, conversationId);
  if (result.claimed) return { text: applyDisclosure(text, line), claim: { conversationId, at: result.at } };
  if (result.error) return { text: applyDisclosure(text, line), claim: null };
  return { text, claim: null };
}

/**
 * Undo a claim after a failed send, so the next send discloses. Only clears
 * the value this caller set. Never throws.
 */
export async function releaseFirstMessage(admin, claim) {
  if (!claim?.conversationId || !claim.at) return;
  try {
    const { error } = await admin
      .from("conversations")
      .update({ disclosed_at: null })
      .eq("id", claim.conversationId)
      .eq("disclosed_at", claim.at);
    if (error) console.warn("[persona-disclosure] release failed:", error.code);
  } catch (err) {
    console.warn("[persona-disclosure] release threw:", err?.message);
  }
}
