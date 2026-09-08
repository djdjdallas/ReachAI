/**
 * analyze-instagram-voice.js
 *
 * Sends a coach's Instagram bio + recent captions to Claude and returns
 * a starter voice profile, starter sales positioning, and a starter
 * greeting (the opening line the reply pipeline requires before it will
 * answer any lead — see the webhook's greeting gate). Used by the
 * post-OAuth voice-profile auto-import pipeline.
 *
 * Defensive scans the caller relies on:
 *   - AI-identity-denial scan (banned strings: "human", "real person",
 *     "not AI") — drops the result entirely if found.
 *   - Meta-banned-words scan ("automate", "bot", "scrape", "monitor") —
 *     drops the result if found after the model's retry.
 *
 * Mirrors generateScript()'s retry-once-on-parse-failure pattern.
 */

import getAnthropic from "@/lib/anthropic";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.3;

const BANNED_META_WORDS = ["automate", "bot", "scrape", "monitor"];
const IDENTITY_DENIAL_FRAGMENTS = ["human", "real person", "not ai"];

const SYSTEM_PROMPT = `You are a voice-and-positioning analyst for high-ticket coaches. You
analyze a coach's Instagram presence (bio + recent captions) and produce:
(1) a voice profile capturing HOW they write
(2) a starter sales positioning capturing WHAT they sell

This analysis pre-fills onboarding for a customer engagement platform.
Quality matters because this is the user's first impression of the
product.

CRITICAL RULES — non-negotiable:
- Never produce voice traits that would instruct an AI to deny being
  an AI, claim to be human, or pretend not to be automated. The
  downstream system has a hard rule against this.
- Use only language acceptable to Meta Platforms: do NOT use the words
  "automate", "bot", "scrape", or "monitor" anywhere in your output.
  Prefer "respond", "engage", "qualify", "route".
- If the bio or captions contain no usable signal for a field, return
  null for that field. Do not fabricate.
- Captions are usually more polished than DMs, so the voice profile
  you generate will be a starter. Set confidence honestly.

OUTPUT: Return ONLY a valid JSON object. No markdown code fences. No
preamble. No explanation. Just the raw JSON starting with { and
ending with }.

The JSON must have exactly this shape:
{
  "voice_profile": {
    "voice_summary": "1-2 sentence description of how they write",
    "voice_traits": {
      "tone": "casual|professional|playful|direct|warm|other",
      "formality": "very_casual|casual|neutral|formal",
      "sentence_length": "very_short|short|medium|long",
      "emoji_usage": "none|minimal|moderate|heavy",
      "punctuation_style": "casual|standard|expressive",
      "vocabulary": "string describing their word choices",
      "catchphrases": ["array", "of", "recurring", "phrases"],
      "personality": "string describing their on-camera energy"
    },
    "suggested_response_length": "short|medium|long",
    "confidence": "high|medium|low"
  },
  "starter_positioning": {
    "offer": "string or null — what they sell, in their voice",
    "target_customer": "string or null — who they sell to",
    "objections": "string or null — likely objections from their avatar",
    "greeting": "string — see GREETING RULES"
  }
}

GREETING RULES — the greeting is the coach's first reply when a new lead
DMs them, written in the coach's own captured voice:
- 1–2 short sentences: a warm acknowledgment plus ONE open question that
  invites the lead to share what brought them here.
- Match the detected tone, formality and emoji usage. No links, no
  prices, and no program names unless they appear in the input.
- Say nothing about who or what is replying.
- Unlike other fields, the greeting must never be null: it makes no
  factual claims, so thin signal is not fabrication — when signal is
  thin, write a simple warm opener in a neutral tone.`;

function buildUserMessage({ bio, name, captions }) {
  const captionTags = (captions || [])
    .slice(0, 3)
    .map((c, i) => {
      const idx = i + 1;
      const ts = c?.timestamp || "";
      const text = (c?.text || "").trim();
      return `  <caption_${idx} timestamp="${escapeXmlAttr(ts)}">${escapeXml(text)}</caption_${idx}>`;
    })
    .join("\n");

  return `<input>
<account_name>${escapeXml(name || "")}</account_name>
<bio>${escapeXml(bio || "")}</bio>
<recent_captions>
${captionTags}
</recent_captions>
</input>

Analyze and return the JSON object as specified.`;
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXmlAttr(s) {
  return escapeXml(s).replace(/"/g, "&quot;");
}

function extractAndParseJSON(text) {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(
        `No JSON object found in response. Raw: ${text.slice(0, 200)}`
      );
    }
    return JSON.parse(match[0]);
  }
}

/**
 * Walks every string leaf in an object and returns the first banned token
 * (lowercased) found, or null. Used by both defensive scans.
 */
function scanStrings(node, tokens) {
  if (node == null) return null;
  if (typeof node === "string") {
    const lower = node.toLowerCase();
    for (const t of tokens) {
      // Use word-ish boundaries so e.g. "monitor" does not match "monitoring"
      // ban only the bare token + common inflections.
      const re = new RegExp(
        `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|ed|ing)?\\b`,
        "i"
      );
      if (re.test(lower)) return t;
    }
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = scanStrings(item, tokens);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node)) {
      const hit = scanStrings(v, tokens);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * AI-identity-denial scan uses raw substring matches (not word boundaries)
 * because "claim to be human" and "real person" are multi-word fragments
 * that don't fit the word-boundary pattern.
 */
function scanIdentityDenial(node) {
  if (node == null) return null;
  if (typeof node === "string") {
    const lower = node.toLowerCase();
    for (const fragment of IDENTITY_DENIAL_FRAGMENTS) {
      if (lower.includes(fragment)) return fragment;
    }
    return null;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = scanIdentityDenial(item);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node)) {
      const hit = scanIdentityDenial(v);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Lightweight shape validation. The system prompt is authoritative, but
 * downstream consumers (script_config merge) assume specific keys exist.
 */
function validateShape(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Response is not an object");
  }
  const vp = parsed.voice_profile;
  if (!vp || typeof vp !== "object") {
    throw new Error("Missing voice_profile");
  }
  if (typeof vp.voice_summary !== "string" || !vp.voice_summary.trim()) {
    throw new Error("Missing voice_profile.voice_summary");
  }
  if (!vp.voice_traits || typeof vp.voice_traits !== "object") {
    throw new Error("Missing voice_profile.voice_traits");
  }
  if (!parsed.starter_positioning || typeof parsed.starter_positioning !== "object") {
    parsed.starter_positioning = { offer: null, target_customer: null, objections: null };
  }
  return parsed;
}

/**
 * @typedef {Object} AnalyzeInstagramVoiceResult
 * @property {object} voice_profile
 * @property {object} starter_positioning
 */

/**
 * Analyzes a coach's Instagram bio + captions and returns a starter
 * voice profile + starter positioning. Retries once on parse failure
 * and once on banned-meta-words detection.
 *
 * @param {{ bio: string, name?: string | null, captions: Array<{ text: string, timestamp?: string }> }} input
 * @returns {Promise<AnalyzeInstagramVoiceResult>}
 * @throws {Error} on repeated parse failure
 * @throws {Error & { kind: "content_flag" }} on identity-denial or repeated meta-banned-words detection
 */
export async function analyzeInstagramVoice({ bio, name, captions }) {
  const userMessage = buildUserMessage({ bio, name, captions });

  let lastErr = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await getAnthropic().messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const raw = response.content[0]?.text?.trim() ?? "";
      const parsed = extractAndParseJSON(raw);
      const validated = validateShape(parsed);

      // Identity-denial scan — hard fail, never retry. Drop and treat as
      // a content_flag so the caller logs and falls through.
      const identityHit = scanIdentityDenial(validated);
      if (identityHit) {
        const err = new Error(
          `Identity-denial fragment detected: "${identityHit}". Payload dropped.`
        );
        err.kind = "content_flag";
        err.payload = validated;
        throw err;
      }

      // Meta-banned-words scan — soft fail on attempt 1 (retry), hard
      // fail on attempt 2.
      const bannedHit = scanStrings(validated, BANNED_META_WORDS);
      if (bannedHit) {
        if (attempt === 1) {
          console.warn(
            `analyzeInstagramVoice attempt 1 contained banned meta word "${bannedHit}", retrying`
          );
          lastErr = new Error(`Banned meta word: ${bannedHit}`);
          continue;
        }
        const err = new Error(
          `Banned meta word "${bannedHit}" still present after retry. Payload dropped.`
        );
        err.kind = "content_flag";
        err.payload = validated;
        throw err;
      }

      return {
        voice_profile: validated.voice_profile,
        starter_positioning: validated.starter_positioning,
      };
    } catch (err) {
      // Content flags bubble up immediately — they are not retryable.
      if (err?.kind === "content_flag") {
        throw err;
      }
      lastErr = err;
      if (attempt === 2) {
        console.error(
          "analyzeInstagramVoice failed after 2 attempts:",
          err?.message
        );
        const final = new Error("parse_failed");
        final.kind = "parse_failed";
        final.cause = err;
        throw final;
      }
      console.warn(
        `analyzeInstagramVoice attempt ${attempt} failed, retrying...`,
        err?.message
      );
    }
  }

  // Unreachable, but keep TS-style guard.
  throw lastErr || new Error("analyzeInstagramVoice exhausted retries");
}
