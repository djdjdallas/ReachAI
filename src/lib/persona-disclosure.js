// First-message AI disclosure for persona accounts (users.business_name
// set). The server, not the model or the clinic's template, prepends
//   "Hi! I'm Katlynne, Solé Aesthetics' AI concierge."
// to the first assistant message actually sent in a conversation: the
// inbound reply, the comment-to-DM opener, a dashboard AI reply, or a drip
// nudge when that happens to be the first thing sent. Coach accounts (no
// business_name) are unchanged.
//
// "Already disclosed" means the lead has already received an app-written
// message in this thread (an assistant row with a Meta message id and
// source agent or drip) or any sent message containing "AI concierge" (the
// comment opener, when Meta's echo stored it as a staff message before the
// app saved it). A saved reply that was never sent (rate-limited, failed)
// has no Meta id, so the next reply still discloses.

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

const firstSentence = (text) => String(text).trim().split(/(?<=[.!?])\s+/)[0] || "";

/**
 * The text with the disclosure prepended (leading greeting removed). Left
 * as-is when it already discloses in its first sentence (e.g. the lead's
 * first message asked "are you a bot?" and rule 7 answered it).
 */
export function applyDisclosure(text, line) {
  const s = String(text ?? "").trim();
  if (!line) return s;
  if (s.includes(line) || /\bAI\b/.test(firstSentence(s))) return s;
  const rest = stripLeadingGreeting(s).trim();
  return rest ? `${line} ${rest}` : line;
}

/**
 * Whether the lead has already been told, in this conversation. Errors read
 * as "not yet": a repeated disclosure is better than a missing one.
 */
export async function conversationHasDisclosed(admin, conversationId) {
  if (!conversationId) return false;
  try {
    const [appSent, mentioned] = await Promise.all([
      admin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .in("source", ["agent", "drip"])
        .not("provider_message_id", "is", null)
        .limit(1),
      admin
        .from("messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("role", "assistant")
        .not("provider_message_id", "is", null)
        .ilike("content", "%AI concierge%")
        .limit(1),
    ]);
    if (appSent.error || mentioned.error) return false;
    return Boolean(appSent.data?.length || mentioned.data?.length);
  } catch {
    return false;
  }
}

/**
 * The text to send: with the disclosure if this is a persona account and the
 * lead hasn't been told yet in this conversation. Never throws.
 *
 * @param {object} admin - service-role client
 * @param {object} user - users row (business_name, assistant_name)
 * @param {string} text - the message about to be saved and sent
 * @param {{conversationId?: string|null}} opts - null/absent: no thread yet
 * @returns {Promise<string>}
 */
export async function discloseOnFirstMessage(admin, user, text, { conversationId = null } = {}) {
  const line = disclosureLine(user);
  if (!line) return text;
  if (await conversationHasDisclosed(admin, conversationId)) return text;
  return applyDisclosure(text, line);
}

/** Whether the next message to this conversation would carry the disclosure. */
export async function needsFirstMessageDisclosure(admin, user, conversationId) {
  if (!disclosureLine(user)) return false;
  return !(await conversationHasDisclosed(admin, conversationId));
}
