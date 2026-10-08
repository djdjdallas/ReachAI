// Pure decision layer for the comment-to-DM shadow pipeline.
//
// decideAction(classification, monitoringSettings, templates, context)
//   → { action, rendered, reason }
//
// No I/O. All Supabase reads happen in the calling route, which passes the
// resolved monitoring row, the templates map, and any context strings the
// renderer needs (post caption, commenter name, offer name, booking link,
// treatment label).

export const ACTIONS = Object.freeze({
  DM: "dm",
  QUEUE_REVIEW: "queue_review",
  IGNORE: "ignore",
  NONE: "none",
});

// Project-wide defaults applied when a post has no monitoring_settings row.
// Mirrors the taxonomy in src/lib/classifier.js — keep in sync if a class is
// added, renamed, or removed there.
export const DEFAULT_ACTIONS_PER_CLASS = Object.freeze({
  HIGH_INTENT: ACTIONS.DM,
  ENGAGED_NOT_BUYING: ACTIONS.QUEUE_REVIEW,
  CRITICAL_NEGATIVE: ACTIONS.IGNORE,
  LOW_SIGNAL: ACTIONS.IGNORE,
  NOT_A_LEAD: ACTIONS.IGNORE,
  SPAM: ACTIONS.IGNORE,
  UNCERTAIN: ACTIONS.QUEUE_REVIEW,
});

const VALID_ACTIONS = new Set(Object.values(ACTIONS));

// Minimum classifier confidence to auto-send a DM. Below it, a class that
// would DM is queued for review instead: a wrong DM from a comment is public
// and can't be taken back. Clear HIGH_INTENT comments score 0.88+ in
// scripts/replay-comment-classifier.mjs; UNCERTAIN is capped at 0.6 by the
// prompt.
export const DM_MIN_CONFIDENCE = 0.8;

function snippet(text, max = 50) {
  if (typeof text !== "string" || !text) return "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

// {{TREATMENT}} is the treatment tagged on the post (persona accounts), as
// its human label ("lip filler"). An untagged post renders the template's
// own fallback, {{TREATMENT|this treatment}}, else DEFAULT_TREATMENT_FALLBACK.
export const DEFAULT_TREATMENT_FALLBACK = "our treatments";
const TREATMENT_TOKEN_RE = /\{\{TREATMENT(?:\|([^{}|]{0,60}))?\}\}/g;

export function renderTemplate(template, context = {}) {
  if (typeof template !== "string" || !template) return "";
  const treatment = typeof context.treatment === "string" ? context.treatment.trim() : "";
  const withTreatment = template.replace(
    TREATMENT_TOKEN_RE,
    (_, fallback) => treatment || (fallback?.trim() || DEFAULT_TREATMENT_FALLBACK)
  );
  const replacements = {
    "{{POST_CAPTION_SNIPPET}}": snippet(context.postCaption || "", 50),
    "{{COMMENTER_NAME}}": context.commenterName || "there",
    "{{OFFER_NAME}}": context.offerName || "our offer",
    "{{BOOKING_LINK}}": context.bookingLink || "",
  };
  let out = withTreatment;
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value);
  }
  // Server-side breadcrumb when a [bracketed_token] survives render — the
  // coach wrote unrecognized placeholder syntax (the dashboard editor warns
  // on save now, but pre-existing rows still trip this). Skipped in the
  // browser because the editor re-renders the preview on every keystroke.
  if (typeof window === "undefined") {
    const stray = out.match(/\[[A-Za-z_][A-Za-z0-9_]*\]/g);
    if (stray) {
      console.warn("[renderTemplate] unsubstituted bracket tokens:", stray);
    }
  }
  return out;
}

function resolveAction(intentClass, monitoringSettings) {
  const fromMonitoring =
    monitoringSettings?.actions_per_class &&
    typeof monitoringSettings.actions_per_class === "object"
      ? monitoringSettings.actions_per_class[intentClass]
      : undefined;
  const candidate = fromMonitoring ?? DEFAULT_ACTIONS_PER_CLASS[intentClass];
  if (typeof candidate !== "string") return ACTIONS.NONE;
  return VALID_ACTIONS.has(candidate) ? candidate : ACTIONS.NONE;
}

/**
 * Decide what (if anything) the agent would do for a given classification.
 *
 * @param {object} classification          - Output of classifyComment().classification
 * @param {object|null} monitoringSettings - post_monitoring_settings row for the post (or null)
 * @param {object|null} templates          - { [intent_class]: template_string }
 * @param {object} [context]               - { postCaption, commenterName, offerName, bookingLink, treatment }
 * @returns {{ action: string, rendered: string|null, reason: string }}
 */
export function decideAction(
  classification,
  monitoringSettings,
  templates,
  context = {}
) {
  if (!classification || typeof classification.class !== "string") {
    return {
      action: ACTIONS.NONE,
      rendered: null,
      reason: "missing_classification",
    };
  }

  if (monitoringSettings && monitoringSettings.enabled === false) {
    return {
      action: ACTIONS.IGNORE,
      rendered: null,
      reason: "monitoring_disabled_for_post",
    };
  }

  const intentClass = classification.class;
  const action = resolveAction(intentClass, monitoringSettings);

  if (action === ACTIONS.NONE) {
    return {
      action: ACTIONS.NONE,
      rendered: null,
      reason: `no_default_for_class:${intentClass}`,
    };
  }

  if (action !== ACTIONS.DM) {
    return {
      action,
      rendered: null,
      reason: `routed_by_class:${intentClass}`,
    };
  }

  // action === DM — the classifier must be confident; otherwise review.
  const confidence =
    typeof classification.confidence === "number" ? classification.confidence : 0;
  if (confidence < DM_MIN_CONFIDENCE) {
    return {
      action: ACTIONS.QUEUE_REVIEW,
      rendered: null,
      reason: `low_confidence:${intentClass}`,
    };
  }

  // Need a template; otherwise downgrade to review.
  const template =
    templates && typeof templates === "object" ? templates[intentClass] : null;

  if (!template) {
    return {
      action: ACTIONS.QUEUE_REVIEW,
      rendered: null,
      reason: "no_template_for_class",
    };
  }

  const rendered = renderTemplate(template, context);

  if (!rendered.trim()) {
    return {
      action: ACTIONS.QUEUE_REVIEW,
      rendered: null,
      reason: "rendered_template_empty",
    };
  }

  return {
    action: ACTIONS.DM,
    rendered,
    reason: `template_rendered:${intentClass}`,
  };
}
