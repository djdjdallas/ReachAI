import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { enforceAiRateLimit } from "@/lib/rate-limit";
import { fetchProfileContent, InstagramFetchError } from "@/lib/instagram/fetch-profile-content";
import { analyzeInstagramVoice } from "@/lib/anthropic/analyze-instagram-voice";

/**
 * Post-OAuth Instagram voice-profile auto-import.
 *
 * Fire-and-forget from the OAuth callback. Single-attempt by design —
 * stamps users.instagram_auto_import_attempted_at before doing any work
 * to guarantee no retry loops, even on crash.
 *
 * Never-overwrite by design — only fills voice_profile when status is
 * not "ready", only fills script_config fields that are currently empty.
 *
 * Always returns 200 (even on error). This is a background enhancement;
 * we never surface failures to the user.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Rate limit — generous because this is fire-and-forget background work.
    const rl = await enforceAiRateLimit(
      admin,
      user.id,
      "instagram_auto_profile",
      5
    );
    if (rl) return rl;

    // Load just the fields we need.
    const { data: profile, error: profileErr } = await admin
      .from("users")
      .select(
        "instagram_business_account_id, meta_user_access_token, voice_profile, script_config, instagram_auto_import_attempted_at"
      )
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error("[auto-profile] failed to load user:", profileErr?.message);
      return NextResponse.json({ skipped: true, reason: "error" });
    }

    // Idempotency: already attempted.
    if (profile.instagram_auto_import_attempted_at) {
      return NextResponse.json({
        skipped: true,
        reason: "already_attempted",
      });
    }

    // Idempotency: user already has a configured voice profile.
    if (profile.voice_profile?.status === "ready") {
      // Stamp anyway so we never re-run.
      await admin
        .from("users")
        .update({ instagram_auto_import_attempted_at: new Date().toISOString() })
        .eq("id", user.id);
      return NextResponse.json({
        skipped: true,
        reason: "voice_profile_already_configured",
      });
    }

    // Required input.
    if (!profile.instagram_business_account_id) {
      return NextResponse.json(
        { error: "instagram_not_connected" },
        { status: 400 }
      );
    }

    // CRITICAL: stamp the attempted_at column BEFORE any real work. This
    // guarantees single-attempt semantics even if the function crashes.
    await admin
      .from("users")
      .update({ instagram_auto_import_attempted_at: new Date().toISOString() })
      .eq("id", user.id);

    // Fetch bio + captions.
    let content;
    try {
      content = await fetchProfileContent(profile);
    } catch (err) {
      if (err instanceof InstagramFetchError) {
        console.error(
          "[auto-profile] graph fetch failed:",
          err.kind,
          err.message
        );
        const reasonMap = {
          token_invalid: "token_invalid",
          rate_limit: "rate_limit",
          no_token: "token_invalid",
        };
        return NextResponse.json({
          skipped: true,
          reason: reasonMap[err.kind] || "error",
        });
      }
      console.error("[auto-profile] unexpected fetch error:", err?.message);
      return NextResponse.json({ skipped: true, reason: "error" });
    }

    if (!content) {
      return NextResponse.json({ skipped: true, reason: "no_signal" });
    }

    // Run Claude analyzer.
    let analyzed;
    try {
      analyzed = await analyzeInstagramVoice({
        bio: content.bio,
        name: content.name,
        captions: content.captions,
      });
    } catch (err) {
      if (err?.kind === "content_flag") {
        console.error(
          "[auto-profile] content flag tripped:",
          err.message,
          JSON.stringify(err.payload).slice(0, 500)
        );
        return NextResponse.json({ skipped: true, reason: "content_flag" });
      }
      if (err?.kind === "parse_failed") {
        return NextResponse.json({ skipped: true, reason: "parse_failed" });
      }
      console.error("[auto-profile] analyzer threw:", err?.message);
      return NextResponse.json({ skipped: true, reason: "error" });
    }

    // ── Merge: voice_profile ────────────────────────────────────────────
    // Replace entirely when current is null/not-ready. Status was already
    // verified above, but re-read to avoid a TOCTOU window.
    const { data: fresh } = await admin
      .from("users")
      .select("voice_profile, script_config")
      .eq("id", user.id)
      .single();

    const update = {};

    if (!fresh?.voice_profile || fresh.voice_profile.status !== "ready") {
      const vp = analyzed.voice_profile || {};
      update.voice_profile = {
        voice_summary: vp.voice_summary,
        voice_traits: vp.voice_traits || {},
        suggested_response_length: ["short", "medium", "long"].includes(
          vp.suggested_response_length
        )
          ? vp.suggested_response_length
          : null,
        confidence: ["high", "medium", "low"].includes(vp.confidence)
          ? vp.confidence
          : "low",
        preview_replies: [],
        sample_count: (content.captions || []).length,
        status: "ready",
        source: "instagram_auto",
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // ── Merge: script_config ─ per-field, never overwrite populated ─────
    const positioning = analyzed.starter_positioning || {};
    const currentSc =
      fresh?.script_config && typeof fresh.script_config === "object"
        ? fresh.script_config
        : {};

    const isEmpty = (v) =>
      v == null || (typeof v === "string" && v.trim().length === 0);

    const newSc = { ...currentSc };
    let scChanged = false;

    if (isEmpty(currentSc.offer) && !isEmpty(positioning.offer)) {
      newSc.offer = positioning.offer.trim();
      scChanged = true;
    }
    if (isEmpty(currentSc.targetCustomer) && !isEmpty(positioning.target_customer)) {
      newSc.targetCustomer = positioning.target_customer.trim();
      scChanged = true;
    }
    if (isEmpty(currentSc.objections) && !isEmpty(positioning.objections)) {
      newSc.objections = positioning.objections.trim();
      scChanged = true;
    }

    if (scChanged) {
      update.script_config = newSc;
    }

    if (Object.keys(update).length > 0) {
      const { error: updateErr } = await admin
        .from("users")
        .update(update)
        .eq("id", user.id);
      if (updateErr) {
        console.error("[auto-profile] db update failed:", updateErr.message);
        return NextResponse.json({ skipped: true, reason: "error" });
      }
    }

    return NextResponse.json({ ok: true, source: "instagram_auto" });
  } catch (err) {
    console.error("[auto-profile] unexpected error:", err);
    // Best-effort: also stamp attempted_at on unexpected exception so we
    // never enter a retry loop, even though the user is already
    // authenticated above. We re-derive the user via the supabase client.
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await getSupabaseAdmin()
          .from("users")
          .update({
            instagram_auto_import_attempted_at: new Date().toISOString(),
          })
          .eq("id", user.id)
          .is("instagram_auto_import_attempted_at", null);
      }
    } catch (innerErr) {
      console.error(
        "[auto-profile] failed to backstop-stamp attempted_at:",
        innerErr?.message
      );
    }
    return NextResponse.json({ skipped: true, reason: "error" });
  }
}
