import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { classifyComment, CLASSIFIER_MODEL, CLASSIFIER_VERSION } from "@/lib/classifier";
import { buildContextBundle } from "@/lib/contextBundle";
import { decideAction } from "@/lib/comment-trigger-rules";
import { sendPrivateReplyToComment } from "@/lib/instagram";
import { decryptToken } from "@/lib/token-utils";
import { canUseCommentToDM } from "@/lib/comment-to-dm-gate";
import { maybePostPublicReply } from "@/lib/comment-public-reply";
import { persistCommentDmConversation } from "@/lib/comment-dm-conversation";

// Phase 2 of the comment-to-DM pipeline. Receives a single change object
// from a Meta Instagram webhook payload (entry.changes[i] where
// change.field === "comments"), classifies the comment, decides what action
// to take, and — when the decision is DM — dispatches a private reply via
// the recipient.comment_id Graph API variant.
//
// Contract: this function MUST NOT throw. Meta retries aggressively on
// non-200 responses, and the webhook handler 200s after we return. All
// errors are caught and logged with the offending comment_id.

// Meta's private-reply window is 7 days from the comment's created_time.
// Past that, the Graph API returns code 100 / subcode 2018278. We check
// locally before the API call so the log carries a clear reason and we
// don't waste a Graph API round-trip.
const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function handleCommentEvent(entry, change) {
  const commentId = change?.value?.id || null;
  try {
    await processCommentEvent(entry, change);
  } catch (err) {
    console.error("[comment-event] threw:", { commentId, error: err?.message });
  }
}

async function processCommentEvent(entry, change) {
  const value = change?.value || {};

  // 1. Pull the fields we care about. Meta's payload shape:
  //   { value: { id, text, media: { id }, from: { id, username },
  //              parent_id?, created_time? } }
  const commentId = value.id || null;
  const mediaId = value.media?.id || value.media_id || null;
  const fromUsername = value.from?.username || null;
  // The commenter's Instagram-scoped id. This is the SAME id the inbound
  // messaging webhook sees as event.sender.id, so it's the key we persist on
  // the conversation row to make the lead's reply match (see
  // src/lib/comment-dm-conversation.js).
  const fromId = value.from?.id || null;
  const commentText = typeof value.text === "string" ? value.text : "";
  const parentId = value.parent_id || null;
  const igbaId = entry?.id || null;
  const commentCreatedAtMs = parseCommentCreatedAt(value);

  if (!commentId || !mediaId || !igbaId) {
    console.warn("[comment-event] missing required fields", { commentId, mediaId, igbaId });
    return;
  }

  // 2. Private replies only apply to top-level comments. Nested replies
  // (parent_id present) cannot be DM-replied to and should be skipped
  // before we burn classifier tokens.
  if (parentId) {
    console.log("[comment-event] skipping nested reply", { commentId, parentId });
    return;
  }

  const admin = getSupabaseAdmin();

  // 3. Resolve the owning creator from the IGBA on the entry. Pulls plan +
  // email for the gate, plus the page access token we'll need at dispatch.
  const { data: ownerUser, error: ownerErr } = await admin
    .from("users")
    .select(
      "id, email, plan, subscription_status, meta_page_access_token, instagram_business_account_id, comment_public_reply_enabled"
    )
    .eq("instagram_business_account_id", igbaId)
    .maybeSingle();

  if (ownerErr) {
    console.error("[comment-event] owner lookup failed:", { igbaId, error: ownerErr.message });
    return;
  }
  if (!ownerUser) {
    console.warn("[comment-event] no Clinchd user for IGBA:", igbaId);
    return;
  }
  const creatorId = ownerUser.id;

  // 4. Gate: skip classifier spend on coaches whose plan doesn't include
  // the feature. Founder bypass kept so Dom can dogfood on his account.
  if (
    !canUseCommentToDM({
      plan: ownerUser.plan,
      email: ownerUser.email,
      subscription_status: ownerUser.subscription_status,
    })
  ) {
    console.log("[comment-event] gate denied — skipping", { commentId, creatorId });
    return;
  }

  // 5. Locate or upsert the posts row for this Instagram media. We need
  // its post_id to look up monitoring settings and to FK the
  // classification row. posts.ig_media_id is UNIQUE so it doubles as the
  // dedup key here.
  const postRow = await findOrCreatePost(admin, creatorId, mediaId);
  if (!postRow) return;

  // 6. Read the per-post monitoring toggle. Saves Anthropic spend when a
  // coach has turned the post off OR hasn't opted-in yet.
  const { data: monitoringRow } = await admin
    .from("post_monitoring_settings")
    .select("enabled, actions_per_class, last_public_reply_text")
    .eq("creator_id", creatorId)
    .eq("post_id", postRow.id)
    .maybeSingle();

  if (!monitoringRow) {
    console.log("[comment-event] no monitoring row — skipping", { commentId, postId: postRow.id });
    return;
  }
  if (monitoringRow.enabled === false) {
    console.log("[comment-event] monitoring disabled — skipping", { commentId, postId: postRow.id });
    return;
  }

  // 7. Dedup: Meta retries webhook deliveries on failure. The unique index
  // idx_classifications_dedup on (creator_id, ig_comment_id) WHERE
  // ig_comment_id IS NOT NULL enforces this at the DB layer, but we check
  // first so we skip classifier spend on retries.
  const { data: existing } = await admin
    .from("comment_classifications")
    .select("id")
    .eq("creator_id", creatorId)
    .eq("ig_comment_id", commentId)
    .maybeSingle();

  if (existing) {
    console.log("[comment-event] already classified — skipping", { commentId, classificationId: existing.id });
    return;
  }

  // 8. Build/reuse the context bundle for this post, then classify.
  const { bundle } = await buildContextBundle({
    postId: postRow.id,
    creatorId,
    caption: postRow.caption || "",
  });

  const { classification, raw, latencyMs } = await classifyComment({
    commentText,
    postCaption: postRow.caption || "",
    creatorOffer: null,
  });

  // Honors the COMMENT_CLASSIFIER_ENABLED env kill switch.
  if (classification?.skipped) {
    console.warn("[comment-event] classifier disabled — skipping", { commentId });
    return;
  }

  const usage = raw?.usage || {};

  // 9. Persist the classification.
  const { data: persisted, error: persistErr } = await admin
    .from("comment_classifications")
    .insert({
      creator_id: creatorId,
      post_id: postRow.id,
      bundle_id: bundle.id,
      ig_comment_id: commentId,
      ig_commenter_username: fromUsername,
      comment_text: commentText,
      class: classification.class,
      confidence: classification.confidence,
      language: classification.language,
      reasoning: classification.reasoning,
      signals: classification.signals,
      model: CLASSIFIER_MODEL,
      classifier_version: CLASSIFIER_VERSION,
      input_tokens: usage.input_tokens || 0,
      output_tokens: usage.output_tokens || 0,
      cache_read_tokens: usage.cache_read_input_tokens || 0,
      cache_creation_tokens: usage.cache_creation_input_tokens || 0,
      latency_ms: latencyMs,
    })
    .select()
    .single();

  if (persistErr) {
    console.error("[comment-event] classification insert failed:", { commentId, error: persistErr.message });
    return;
  }

  // 10. Decide what to do. decideAction already downgrades DM-class results
  // to queue_review with reason "no_template_for_class" when no template
  // exists, so reaching action === "dm" implies decision.rendered is
  // non-empty.
  // Fetch templates, offer name, and booking link in parallel. Offer and
  // booking link feed the renderTemplate substitutions for {{OFFER_NAME}}
  // and {{BOOKING_LINK}} — without these, DMs render the fallback strings
  // ("our offer" / empty) regardless of what the coach has saved.
  const [
    { data: templateRows },
    { data: userRow },
    { data: offerRow },
  ] = await Promise.all([
    admin
      .from("dm_templates")
      .select("intent_class, template")
      .eq("creator_id", creatorId),
    admin
      .from("users")
      .select("calendly_url")
      .eq("id", creatorId)
      .maybeSingle(),
    admin
      .from("creator_offers")
      .select("offer_name")
      .eq("creator_id", creatorId)
      .is("deprecated_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const templates = {};
  for (const row of templateRows || []) {
    if (row?.intent_class && typeof row.template === "string") {
      templates[row.intent_class] = row.template;
    }
  }

  const decision = decideAction(classification, monitoringRow, templates, {
    postCaption: postRow.caption || "",
    commenterName: fromUsername,
    offerName: offerRow?.offer_name || null,
    bookingLink: userRow?.calendly_url || null,
  });

  // 11. Decide branches:
  //   - Non-DM action: log decision, exit (no Graph API call).
  //   - DM action: stale-window check → dispatch → record outcome.
  let logFields = {
    comment_classification_id: persisted.id,
    creator_id: creatorId,
    decided_action: decision.action,
    rendered_dm: decision.rendered,
    dispatched: false,
  };

  if (decision.action !== "dm") {
    logFields = await logDecision(admin, logFields, { commentId });
    console.log("[comment-event] processed (non-dm)", {
      commentId,
      classificationId: persisted.id,
      class: classification.class,
      decided_action: decision.action,
      reason: decision.reason,
    });
    return;
  }

  // 12. Pre-flight: enforce the 7-day private-reply window when we know the
  // comment timestamp. If we don't have one (older webhook payload shapes)
  // we let Meta enforce it and surface stale_comment from sendPrivateReply.
  if (
    commentCreatedAtMs &&
    Date.now() - commentCreatedAtMs > PRIVATE_REPLY_WINDOW_MS
  ) {
    await logDecision(
      admin,
      {
        ...logFields,
        decided_action: "dm_stale",
        dispatched: false,
        dispatch_error: "stale_comment",
        dispatch_retryable: false,
      },
      { commentId }
    );
    console.warn("[comment-event] dropped — comment older than 7 days", {
      commentId,
      ageMs: Date.now() - commentCreatedAtMs,
    });
    return;
  }

  // 13. Dispatch the private reply. The dispatch is fire-and-record: if it
  // fails for any reason we still write a log row so the outcome is
  // auditable. We never re-throw — Meta would just retry the webhook.
  const pageToken = ownerUser.meta_page_access_token
    ? decryptToken(ownerUser.meta_page_access_token)
    : null;

  if (!pageToken) {
    await logDecision(
      admin,
      {
        ...logFields,
        decided_action: "dm_no_token",
        dispatch_error: "missing_page_token",
        dispatch_retryable: false,
      },
      { commentId }
    );
    console.error("[comment-event] dispatch skipped — no decrypted page token", { commentId });
    return;
  }

  // Reserve a Meta 200/hr outbound slot before sending — the DM/voice paths
  // reserve-first, but comment DMs used to bypass the budget entirely: the
  // exact repetitive-send pattern that previously earned a 30-day Meta
  // restriction. RPC failure fails open (matches the other paths).
  const { data: outboundAllowed, error: outboundErr } = await admin.rpc(
    "check_and_record_outbound",
    { uid: creatorId }
  );
  if (outboundErr) {
    console.warn("[comment-event] outbound rate RPC failed:", outboundErr.message);
  } else if (outboundAllowed === false) {
    await logDecision(
      admin,
      {
        ...logFields,
        decided_action: "dm_rate_limited",
        dispatched: false,
        dispatch_error: "outbound_rate_limited",
        dispatch_retryable: true,
      },
      { commentId }
    );
    console.warn("[comment-event] dispatch skipped — 200/hr outbound cap", { commentId });
    return;
  }

  const result = await sendPrivateReplyToComment(
    ownerUser.instagram_business_account_id,
    commentId,
    decision.rendered,
    pageToken
  );

  if (result.success) {
    await logDecision(
      admin,
      {
        ...logFields,
        dispatched: true,
        dispatched_at: new Date().toISOString(),
        dispatched_message_id: result.messageId || null,
      },
      { commentId }
    );
    console.log("[comment-event] dm dispatched", {
      commentId,
      classificationId: persisted.id,
      messageId: result.messageId,
    });

    // Persist the DM into the conversation system so the lead's reply matches
    // an existing thread (AI gets the opening DM as history) and the send is
    // traceable in the inbox. Never throws — the DM has already gone out.
    await persistCommentDmConversation({
      admin,
      userId: creatorId,
      recipientIgsid: fromId,
      senderName: fromUsername,
      renderedDm: decision.rendered,
      providerMessageId: result.messageId || null,
    });

    // Optional public reply under the trigger comment ("sent! check your
    // dms 🙌"). Runs ONLY after a successful DM dispatch, is opt-in via
    // users.comment_public_reply_enabled (default false), and never throws
    // — a failed public reply must not disturb the DM that already went
    // out. See src/lib/comment-public-reply.js.
    await maybePostPublicReply({
      admin,
      ownerUser,
      postId: postRow.id,
      commentId,
      commentClassificationId: persisted.id,
      commenterUsername: fromUsername,
      lastReplyText: monitoringRow.last_public_reply_text || null,
      pageToken,
    });
    return;
  }

  await logDecision(
    admin,
    {
      ...logFields,
      dispatched: false,
      dispatch_error: result.error,
      dispatch_retryable: result.retryable === true,
    },
    { commentId }
  );
  console.warn("[comment-event] dm dispatch failed", {
    commentId,
    error: result.error,
    retryable: result.retryable,
  });
}

// Posts come in from comments before any other ingest path knows about
// them. Upsert so we don't lose the FK target on cold accounts. ig_media_id
// is UNIQUE so a parallel webhook for a different comment on the same post
// will hit the existing row.
async function findOrCreatePost(admin, creatorId, mediaId) {
  const { data: existing } = await admin
    .from("posts")
    .select("id, caption, ig_media_id")
    .eq("ig_media_id", mediaId)
    .maybeSingle();

  if (existing) return existing;

  const { data: inserted, error } = await admin
    .from("posts")
    .insert({
      creator_id: creatorId,
      ig_media_id: mediaId,
      media_type: "WEBHOOK_INGEST",
      caption: null,
      posted_at: new Date().toISOString(),
    })
    .select("id, caption, ig_media_id")
    .single();

  if (error) {
    console.error("[comment-event] post upsert failed:", { mediaId, error: error.message });
    return null;
  }
  return inserted;
}

// Meta sends comment timestamps in either of two shapes depending on the
// webhook product version. Normalize to a millisecond epoch or return null
// if the payload lacks a timestamp (older shape — degrade gracefully and
// let Meta enforce the window).
function parseCommentCreatedAt(value) {
  const candidate = value?.created_time ?? value?.timestamp;
  if (candidate == null) return null;
  if (typeof candidate === "number") {
    return candidate < 1e12 ? candidate * 1000 : candidate;
  }
  if (typeof candidate === "string") {
    const numeric = Number(candidate);
    if (!Number.isNaN(numeric) && numeric > 0) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(candidate);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function logDecision(admin, fields, ctx) {
  const { error } = await admin.from("comment_to_dm_log").insert(fields);
  if (error) {
    console.error("[comment-event] log insert failed:", {
      commentId: ctx?.commentId,
      decided_action: fields.decided_action,
      error: error.message,
    });
  }
  return fields;
}
