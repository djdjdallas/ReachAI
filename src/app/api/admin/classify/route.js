import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { classifyComment, CLASSIFIER_MODEL, CLASSIFIER_VERSION } from "@/lib/classifier";
import { buildContextBundle } from "@/lib/contextBundle";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";
import { decideAction } from "@/lib/comment-trigger-rules";
import { getPostHogClient } from "@/lib/posthog-server";
// eslint-disable-next-line no-unused-vars
import { hasCommentToDM } from "@/lib/plans";

// POST /api/admin/classify
// Body: {
//   caption: string,
//   comment: string,                       // required, the comment to classify
//   offer?: object,                        // only honored when offerOverride === true
//   offerOverride?: boolean,               // when true, `offer` is used as a one-off
//                                          // bundle snapshot WITHOUT persisting to
//                                          // creator_offers (admin override path)
//   imageUrl?: string                      // optional, requires VISION_ENABLED env
// }
//
// Shadow-mode test endpoint used only by the admin-only /admin/classifier page.
// Default path reads the creator's active (non-deprecated) creator_offers row.
// Persists a `posts` row, a `post_context_bundles` row (versioned), the
// `comment_classifications` row, and a `comment_to_dm_log` simulation row.
// Does NOT write to `creator_offers` — that's owned by /api/settings/offer.
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isIntentClassifierEnabled(user.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // TODO(comment-to-DM gate): once the feature un-shadows post Meta App
    // Review, replace the email allowlist above with a plan-tier gate:
    //   const { data: profile } = await supabase
    //     .from("users").select("plan").eq("id", user.id).single();
    //   if (!hasCommentToDM(profile?.plan)) {
    //     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    //   }

    const body = await request.json().catch(() => ({}));
    const caption = typeof body.caption === "string" ? body.caption : "";
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const offerOverride = body.offerOverride === true;
    const inlineOffer =
      offerOverride &&
      body.offer &&
      typeof body.offer === "object" &&
      !Array.isArray(body.offer)
        ? body.offer
        : null;
    // Optional vision input. classifyComment() ignores this when
    // VISION_ENABLED is unset, so passing a URL with the env off is a no-op.
    const imageUrl =
      typeof body.imageUrl === "string" && body.imageUrl.trim()
        ? body.imageUrl.trim()
        : null;

    if (!comment) {
      return NextResponse.json(
        { error: "comment is required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Default path: use the creator's active saved offer (set via
    // /settings/offer). Override path: bundle uses the inline JSON snapshot
    // without persisting, so a one-off test does not create a competing
    // creator_offers row.
    let savedOfferRow = null;
    if (!inlineOffer) {
      const { data: row } = await admin
        .from("creator_offers")
        .select("*")
        .eq("creator_id", user.id)
        .is("deprecated_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      savedOfferRow = row;
    }
    const effectiveOffer = inlineOffer || savedOfferRow || null;

    // Find or create a `posts` row for this caption. Shadow mode doesn't have
    // an ig_media_id, so we key off (creator_id, caption) to get stable
    // bundle-cache behavior on repeated classifications of the same caption.
    let postRow = null;
    const { data: existingPost } = await admin
      .from("posts")
      .select("*")
      .eq("creator_id", user.id)
      .is("ig_media_id", null)
      .eq("caption", caption)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPost) {
      postRow = existingPost;
    } else {
      const { data: inserted, error: postErr } = await admin
        .from("posts")
        .insert({
          creator_id: user.id,
          ig_media_id: null,
          media_type: "SHADOW_MANUAL",
          caption,
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (postErr) {
        return NextResponse.json(
          { error: `Failed to create post row: ${postErr.message}` },
          { status: 500 }
        );
      }
      postRow = inserted;
    }

    const { bundle } = await buildContextBundle({
      postId: postRow.id,
      creatorId: user.id,
      caption,
      creatorOfferId: !inlineOffer ? savedOfferRow?.id : undefined,
      offerSnapshotOverride: inlineOffer || undefined,
    });

    const { classification, raw, latencyMs } = await classifyComment({
      commentText: comment,
      postCaption: caption,
      creatorOffer: effectiveOffer,
      imageUrl,
    });

    const usage = raw?.usage || {};
    const inputTokens = usage.input_tokens || 0;
    const outputTokens = usage.output_tokens || 0;
    const cacheReadTokens = usage.cache_read_input_tokens || 0;
    const cacheCreationTokens = usage.cache_creation_input_tokens || 0;

    const { data: persisted, error: persistErr } = await admin
      .from("comment_classifications")
      .insert({
        creator_id: user.id,
        post_id: postRow.id,
        bundle_id: bundle.id,
        ig_comment_id: null,
        ig_commenter_username: null,
        comment_text: comment,
        class: classification.class,
        confidence: classification.confidence,
        language: classification.language,
        reasoning: classification.reasoning,
        signals: classification.signals,
        model: CLASSIFIER_MODEL,
        classifier_version: CLASSIFIER_VERSION,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_tokens: cacheReadTokens,
        cache_creation_tokens: cacheCreationTokens,
        latency_ms: latencyMs,
      })
      .select()
      .single();

    if (persistErr) {
      return NextResponse.json(
        { error: `Failed to persist classification: ${persistErr.message}` },
        { status: 500 }
      );
    }

    // ── Trigger simulation ───────────────────────────────────────────────
    // Look up monitoring + templates for this creator/post, run the pure
    // decideAction(), and persist the simulated outcome to comment_to_dm_log.
    // Failures here should NOT fail the classification request — the
    // classification has already been written and the user wants to see it.
    let triggerDecision = null;
    let triggerLogId = null;
    try {
      const [{ data: monitoringRow }, { data: templateRows }] =
        await Promise.all([
          admin
            .from("post_monitoring_settings")
            .select("enabled, actions_per_class")
            .eq("creator_id", user.id)
            .eq("post_id", postRow.id)
            .maybeSingle(),
          admin
            .from("dm_templates")
            .select("intent_class, template")
            .eq("creator_id", user.id),
        ]);

      const templates = {};
      for (const row of templateRows || []) {
        if (row?.intent_class && typeof row.template === "string") {
          templates[row.intent_class] = row.template;
        }
      }

      triggerDecision = decideAction(classification, monitoringRow, templates, {
        postCaption: caption,
        commenterName: null,
        offerName: effectiveOffer?.offer_name || null,
        bookingLink: null,
      });

      const { data: logRow, error: logErr } = await admin
        .from("comment_to_dm_log")
        .insert({
          comment_classification_id: persisted.id,
          creator_id: user.id,
          decided_action: triggerDecision.action,
          rendered_dm: triggerDecision.rendered,
          dispatched: false,
        })
        .select("id")
        .single();

      if (logErr) {
        console.error("comment_to_dm_log insert failed:", logErr.message);
      } else {
        triggerLogId = logRow.id;
      }

      try {
        const ph = getPostHogClient();
        ph.capture({
          distinctId: user.id,
          event: "comment_trigger_decided",
          properties: {
            action: triggerDecision.action,
            reason: triggerDecision.reason,
            class: classification.class,
            confidence: classification.confidence,
            has_template: Boolean(templates[classification.class]),
          },
        });
        if (triggerLogId) {
          ph.capture({
            distinctId: user.id,
            event: "comment_simulated",
            properties: {
              decided_action: triggerDecision.action,
              log_id: triggerLogId,
            },
          });
        }
      } catch (phErr) {
        console.error("PostHog capture failed:", phErr.message);
      }
    } catch (triggerErr) {
      console.error("Trigger simulation failed:", triggerErr);
    }

    return NextResponse.json({
      classificationId: persisted.id,
      classification,
      usage: {
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        latencyMs,
      },
      postId: postRow.id,
      bundleId: bundle.id,
      bundleVersion: bundle.version,
      trigger: triggerDecision
        ? {
            action: triggerDecision.action,
            reason: triggerDecision.reason,
            rendered: triggerDecision.rendered,
            logId: triggerLogId,
          }
        : null,
    });
  } catch (err) {
    console.error("Admin classify error:", err);
    return NextResponse.json(
      { error: "Classification failed. Check server logs." },
      { status: 500 }
    );
  }
}
