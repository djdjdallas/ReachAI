// Clinic accounts: the treatment tagged on a watched post. Safe for client
// and server (no server-only imports).
//
// A clinic picks one of its treatment_categories per post
// (post_monitoring_settings.treatment_key). Comment DMs render
// {{TREATMENT}} as that treatment's label, and the lead's profile is seeded
// with the key. Coach accounts never reach this module, so their templates
// render exactly as before ({{TREATMENT}} is not a coach token).

import { findTreatment, normalizeTreatmentCategories, treatmentLabel } from "@/lib/outbound-webhooks/lead-capture";

// What an untagged post renders when the template gives no fallback of its
// own ({{TREATMENT|this treatment}}).
export const DEFAULT_TREATMENT_FALLBACK = "our treatments";
const TREATMENT_TOKEN_RE = /\{\{TREATMENT(?:\|([^{}|]{0,60}))?\}\}/g;

/**
 * Replace {{TREATMENT}} and {{TREATMENT|fallback}} with the label, or the
 * fallback when there is none. Other tokens are left for renderTemplate.
 *
 * @param {string} template
 * @param {string|null} label
 * @returns {string}
 */
export function renderTreatmentTokens(template, label) {
  if (typeof template !== "string") return template;
  const value = typeof label === "string" ? label.trim() : "";
  return template.replace(TREATMENT_TOKEN_RE, (_, fallback) => value || fallback?.trim() || DEFAULT_TREATMENT_FALLBACK);
}

/**
 * The post's treatment, when the tag is still in the account's list.
 *
 * @param {object} user - users row (treatment_categories)
 * @param {string|null} key - post_monitoring_settings.treatment_key
 * @returns {{key: string, label: string}|null}
 */
export function postTreatment(user, key) {
  const match = findTreatment(user?.treatment_categories, key);
  return match ? { key: match.key, label: treatmentLabel([match], match.key) } : null;
}

/**
 * The treatments a clinic can tag a post with, for the post picker.
 *
 * @returns {Array<{key: string, label: string}>}
 */
export function treatmentOptions(user) {
  return normalizeTreatmentCategories(user?.treatment_categories).map((c) => ({
    key: c.key,
    label: treatmentLabel([c], c.key),
  }));
}
