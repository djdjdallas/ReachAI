import crypto from "crypto";
import { getSupabaseAdmin } from "./supabase/admin";

function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

function hashBundle({ caption, offerSnapshot }) {
  const payload = stableStringify({
    caption: caption || "",
    offer: offerSnapshot || null,
  });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function approxTokenCount(text) {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

/**
 * Build (or reuse) a post_context_bundles row for a given post.
 *
 * v1 bundle contents: caption + creator_offers snapshot. Vision OCR and Reel
 * transcription are deferred to v1.1 / v1.5 respectively — see TODO markers
 * below for the plug-in points.
 *
 * @param {object} args
 * @param {string} args.postId
 * @param {string} args.creatorId
 * @param {string} args.caption
 * @param {string} [args.creatorOfferId] - Optional creator_offers row id.
 * @param {object|null} [args.offerSnapshotOverride] - Inline snapshot used
 *   instead of looking up creator_offers. Used by the playground "Advanced:
 *   override" path so a one-off test offer doesn't pollute the saved row.
 * @returns {Promise<{bundle: object, offerSnapshot: object|null, reused: boolean}>}
 */
export async function buildContextBundle({
  postId,
  creatorId,
  caption,
  creatorOfferId,
  offerSnapshotOverride,
}) {
  if (!postId) throw new Error("buildContextBundle: postId is required");
  if (!creatorId) throw new Error("buildContextBundle: creatorId is required");

  const admin = getSupabaseAdmin();

  let offerSnapshot = null;
  if (offerSnapshotOverride && typeof offerSnapshotOverride === "object") {
    offerSnapshot = offerSnapshotOverride;
  } else if (creatorOfferId) {
    const { data: offerRow } = await admin
      .from("creator_offers")
      .select("*")
      .eq("id", creatorOfferId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    if (offerRow) offerSnapshot = offerRow;
  } else {
    // Most-recent NON-deprecated offer is the active one. Mirrors the lookup
    // in /settings/offer and /admin/classifier.
    const { data: offerRow } = await admin
      .from("creator_offers")
      .select("*")
      .eq("creator_id", creatorId)
      .is("deprecated_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (offerRow) offerSnapshot = offerRow;
  }

  // TODO(v1.1): fetch Gemini 2.5 Flash vision JSON for the post media and
  //   include it in the hash + snapshot.
  // TODO(v1.5): fetch Deepgram Nova-3 transcript for Reels and include.

  const bundleHash = hashBundle({ caption, offerSnapshot });

  const { data: latest } = await admin
    .from("post_context_bundles")
    .select("*")
    .eq("post_id", postId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && latest.bundle_hash === bundleHash) {
    return { bundle: latest, offerSnapshot, reused: true };
  }

  const nextVersion = latest ? latest.version + 1 : 1;
  const tokenCount =
    approxTokenCount(caption) +
    approxTokenCount(offerSnapshot ? JSON.stringify(offerSnapshot) : "");

  const { data: inserted, error } = await admin
    .from("post_context_bundles")
    .insert({
      post_id: postId,
      version: nextVersion,
      bundle_hash: bundleHash,
      caption: caption || "",
      creator_offer_snapshot: offerSnapshot,
      token_count: tokenCount,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to persist context bundle: ${error.message}`);
  }

  return { bundle: inserted, offerSnapshot, reused: false };
}
