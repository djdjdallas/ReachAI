// Which intent classes have a written DM template, for the picker's
// "No template written" warning. dm_templates stores the copy in
// `template` (the warning read a nonexistent `body` column, so it showed
// for every class set to DM).

/**
 * @param {Array<{intent_class?: string, template?: string}>|null} rows - dm_templates rows
 * @returns {Record<string, boolean>}
 */
export function templatesByClassFrom(rows) {
  const out = {};
  for (const t of rows || []) {
    if (!t?.intent_class) continue;
    out[t.intent_class] = typeof t.template === "string" && t.template.trim().length > 0;
  }
  return out;
}
