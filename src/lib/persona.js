// Per-account persona settings (server-only users columns, set by
// scripts/managed-account.mjs): assistant_name, business_name, holding_text.
// Validation lives here so the admin script and the prompt builder agree.
//
// A persona is a name for an AI assistant, never a person: the prompt's
// identity rules still make it disclose AI in its first sentence when asked
// (src/lib/prompts.js rule 7), and it can never claim to be human.

import { lintReply } from "./reply-lint";
import { detectHandoff } from "./handoff-reply";

const ASSISTANT_NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]{0,39}$/u;
const HUMAN_CLAIM_RE = /\b(?:i'?m|i am|this is)\s+(?:a\s+)?(?:real\s+)?(?:human|person|nurse|doctor|injector|staff member|receptionist)\b/i;

/** @returns {string|null} the cleaned assistant name, or null when invalid */
export function cleanAssistantName(value) {
  const s = typeof value === "string" ? value.normalize("NFC").replace(/\s+/g, " ").trim() : "";
  return ASSISTANT_NAME_RE.test(s) ? s : null;
}

/** @returns {string|null} the cleaned business name, or null when invalid */
export function cleanBusinessName(value) {
  const s = typeof value === "string" ? value.normalize("NFC").replace(/[\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim() : "";
  // No prompt-structure characters: this is interpolated into the system
  // prompt.
  if (!s || s.length > 80 || /[<>{}`]/.test(s)) return null;
  return s;
}

/**
 * Whether a holding text override is safe to send as-is. It goes to leads
 * verbatim (it is never linted at send time), so it must already pass the
 * reply linter: no em dashes, markdown, placeholders, handoff markers, or
 * claims to be a person. The filler-opener fix is the one lint rule
 * ignored, so wording like the default "Good question, ..." stays allowed.
 *
 * @param {string} text
 * @returns {{ok: true, text: string} | {ok: false, reason: string}}
 */
export function validateHoldingText(text) {
  const s = typeof text === "string" ? text.trim() : "";
  if (!s) return { ok: false, reason: "empty" };
  if (s.length > 300) return { ok: false, reason: "too_long" };
  if (detectHandoff(s)) return { ok: false, reason: "contains_handoff_marker" };
  if (HUMAN_CLAIM_RE.test(s)) return { ok: false, reason: "claims_to_be_human" };
  const lint = lintReply(s);
  if (lint.blocked) return { ok: false, reason: "placeholder" };
  const fixes = lint.fixes.filter((f) => f !== "filler_opener");
  if (fixes.length) return { ok: false, reason: `lint:${fixes.join(",")}` };
  if (/[<>]{2}|\bhandoff\b/i.test(s)) return { ok: false, reason: "contains_handoff_marker" };
  return { ok: true, text: s };
}

/**
 * The persona fields the prompt needs, cleaned. Invalid values are dropped
 * (the prompt falls back to the single-owner identity).
 *
 * @param {object} user - users row
 * @returns {{assistantName: string|null, businessName: string|null}}
 */
export function personaFromUser(user) {
  return {
    assistantName: cleanAssistantName(user?.assistant_name),
    businessName: cleanBusinessName(user?.business_name),
  };
}
