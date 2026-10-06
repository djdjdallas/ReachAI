// Server-side lead facts for outbound webhooks: the lead's Instagram
// username, an email or phone they typed, and a treatment category. Writes
// public.lead_profiles (server-only), whose trigger emits contact_captured.
//
// Runs only for accounts with an enabled outbound webhook: other accounts
// get no extraction and no new stored copy of lead contact details.
//
// Only validated values are stored: an email that matches the format, a
// phone normalized to E.164 (US default; ambiguous or unparseable numbers
// are dropped), and a category KEY from the account's own list. Lead free
// text is never stored here.

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,24}/gi;
// A run of digits with common separators, optionally starting with +.
const PHONE_CANDIDATE_RE = /(?<![\w@])\+?\d[\d\s().-]{6,20}\d(?![\w@])/g;
const USERNAME_RE = /^[A-Za-z0-9._]{1,30}$/;
const CATEGORY_KEY_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/**
 * The one email in the text, lowercased; null when there is none or more
 * than one distinct address (ambiguous).
 */
export function extractEmail(text) {
  const found = new Set(
    (String(text || "").match(EMAIL_RE) || [])
      .map((e) => e.toLowerCase().replace(/\.+$/, ""))
      .filter((e) => e.length <= 254 && !e.includes(".."))
  );
  return found.size === 1 ? [...found][0] : null;
}

// NANP: area code and exchange start 2-9; N11 area codes are services.
function validNanp(ten) {
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) && !/^[2-9]11/.test(ten);
}

/**
 * One candidate string → E.164, or null.
 *   +<digits>: kept when 8-15 digits (and NANP-valid for +1)
 *   10 digits, or 11 starting with 1: a US/NANP number
 *   anything else: dropped (ambiguous)
 */
export function normalizePhone(raw) {
  const s = String(raw || "").trim();
  const digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) {
    if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
    if (digits.startsWith("1")) return digits.length === 11 && validNanp(digits.slice(1)) ? `+${digits}` : null;
    return `+${digits}`;
  }
  if (digits.length === 10 && validNanp(digits)) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1") && validNanp(digits.slice(1))) return `+${digits}`;
  return null;
}

/** The one phone number in the text as E.164; null when none or ambiguous. */
export function extractPhone(text) {
  const found = new Set();
  for (const m of String(text || "").matchAll(PHONE_CANDIDATE_RE)) {
    const e164 = normalizePhone(m[0]);
    if (e164) found.add(e164);
  }
  return found.size === 1 ? [...found][0] : null;
}

/**
 * The account's treatment list, validated. Stored on users as
 *   [{"key": "botox", "match": ["botox", "tox", "dysport"]}, ...]
 * Invalid entries are dropped.
 *
 * @returns {Array<{key: string, match: string[]}>}
 */
export function normalizeTreatmentCategories(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const entry of value.slice(0, 50)) {
    const key = typeof entry?.key === "string" ? entry.key.trim().toLowerCase() : "";
    if (!CATEGORY_KEY_RE.test(key)) continue;
    const terms = (Array.isArray(entry.match) ? entry.match : [])
      .filter((t) => typeof t === "string")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2 && t.length <= 40)
      .slice(0, 30);
    out.push({ key, match: terms.length ? terms : [key.replace(/[_-]+/g, " ")] });
  }
  return out;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The category key whose term appears earliest in the text (whole words,
 * case-insensitive); ties go to the earlier category in the list. Returns
 * only a key from the list, never text from the message.
 *
 * @returns {string|null}
 */
export function matchTreatment(categories, text) {
  const hay = String(text || "").toLowerCase();
  if (!hay) return null;
  let best = null;
  for (const { key, match } of categories) {
    for (const term of match) {
      const m = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term)}(?![\\p{L}\\p{N}])`, "u").exec(hay);
      if (m && (best === null || m.index < best.index)) best = { key, index: m.index };
    }
  }
  return best ? best.key : null;
}

export function validUsername(name) {
  const s = typeof name === "string" ? name.trim().replace(/^@/, "") : "";
  return USERNAME_RE.test(s) ? s : null;
}

/**
 * Whether the account has an enabled outbound webhook. Errors read as no.
 */
export async function hasEnabledOutboundWebhook(admin, userId) {
  try {
    const { data, error } = await admin
      .from("outbound_webhooks")
      .select("id")
      .eq("user_id", userId)
      .eq("enabled", true)
      .maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/**
 * Record what this message tells us about the lead. Never throws; a failure
 * here must not touch the DM pipeline.
 *
 * Email and phone: the latest valid value wins (a lead correcting a typo
 * should reach the clinic). Username and treatment: first value wins.
 *
 * @param {object} admin - service-role client
 * @param {{userId: string, conversationId: string, text?: string, instagramUsername?: string, treatmentCategories?: any}} args
 *   treatmentCategories: users.treatment_categories when the caller has the
 *   row; loaded here when undefined.
 * @returns {Promise<{written: boolean}>}
 */
export async function captureLeadFacts(admin, { userId, conversationId, text, instagramUsername, treatmentCategories }) {
  try {
    if (!userId || !conversationId) return { written: false };
    if (!(await hasEnabledOutboundWebhook(admin, userId))) return { written: false };

    let categories = treatmentCategories;
    if (categories === undefined) {
      const { data: u } = await admin.from("users").select("treatment_categories").eq("id", userId).maybeSingle();
      categories = u?.treatment_categories;
    }

    const { data: existing, error: readErr } = await admin
      .from("lead_profiles")
      .select("instagram_username, email, phone, treatment_interest")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (readErr) {
      console.warn("[lead-capture] read failed:", readErr.code);
      return { written: false };
    }

    const patch = {};
    const username = validUsername(instagramUsername);
    if (username && !existing?.instagram_username) patch.instagram_username = username;
    const email = extractEmail(text);
    if (email && email !== existing?.email) patch.email = email;
    const phone = extractPhone(text);
    if (phone && phone !== existing?.phone) patch.phone = phone;
    if (!existing?.treatment_interest) {
      const key = matchTreatment(normalizeTreatmentCategories(categories), text);
      if (key) patch.treatment_interest = key;
    }
    if (!Object.keys(patch).length) return { written: false };

    const { error } = await admin
      .from("lead_profiles")
      .upsert(
        { conversation_id: conversationId, user_id: userId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "conversation_id" }
      );
    if (error) {
      console.warn("[lead-capture] upsert failed:", error.code);
      return { written: false };
    }
    return { written: true };
  } catch (err) {
    console.warn("[lead-capture] threw:", err?.message);
    return { written: false };
  }
}
