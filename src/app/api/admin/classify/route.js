import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { classifyComment, CLASSIFIER_MODEL, CLASSIFIER_VERSION } from "@/lib/classifier";
import { buildContextBundle } from "@/lib/contextBundle";
import { isIntentClassifierEnabled } from "@/lib/featureFlags";
// eslint-disable-next-line no-unused-vars
import { hasCommentToDM } from "@/lib/plans";

// POST /api/admin/classify
// Body: { caption: string, offer: object|null, comment: string }
//
// Shadow-mode test endpoint used only by the admin-only /admin/classifier page.
// Persists a post + offer + bundle + classification so the founder can verify
// caching, accuracy, and feedback end-to-end.
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
    const offer =
      body.offer && typeof body.offer === "object" && !Array.isArray(body.offer)
        ? body.offer
        : null;

    if (!comment) {
      return NextResponse.json(
        { error: "comment is required" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Upsert a creator_offers row keyed by (creator_id, offer_name) if an offer
    // was supplied. The shadow-mode test page passes a fresh snapshot each
    // time; we store it so the classifier sees a persisted record and so the
    // bundle hash stays stable across repeated classifications of the same
    // (caption, offer) pair.
    let offerRow = null;
    if (offer && (offer.offer_name || offer.offer_url || offer.ideal_customer)) {
      const payload = {
        creator_id: user.id,
        offer_name: offer.offer_name || "Shadow-mode test offer",
        offer_price_cents:
          typeof offer.offer_price_cents === "number"
            ? offer.offer_price_cents
            : null,
        offer_url: offer.offer_url || null,
        ideal_customer: offer.ideal_customer || null,
        objections: Array.isArray(offer.objections) ? offer.objections : null,
        qualification_questions: Array.isArray(offer.qualification_questions)
          ? offer.qualification_questions
          : null,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await admin
        .from("creator_offers")
        .select("id")
        .eq("creator_id", user.id)
        .eq("offer_name", payload.offer_name)
        .maybeSingle();

      if (existing) {
        const { data: updated } = await admin
          .from("creator_offers")
          .update(payload)
          .eq("id", existing.id)
          .select()
          .single();
        offerRow = updated;
      } else {
        const { data: inserted } = await admin
          .from("creator_offers")
          .insert(payload)
          .select()
          .single();
        offerRow = inserted;
      }
    }

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
      creatorOfferId: offerRow?.id,
    });

    const { classification, raw, latencyMs } = await classifyComment({
      commentText: comment,
      postCaption: caption,
      creatorOffer: offerRow || offer || null,
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
    });
  } catch (err) {
    console.error("Admin classify error:", err);
    return NextResponse.json(
      { error: "Classification failed. Check server logs." },
      { status: 500 }
    );
  }
}
