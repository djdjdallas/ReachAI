import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// POST /api/settings/offer
// Body: { offer_name, offer_price_cents, offer_url, ideal_customer,
//         objections[], qualification_questions[] }
//
// One active offer per creator. Strategy:
//   1. Mark all existing non-deprecated rows for this creator as deprecated.
//   2. Insert a single new active row with the submitted fields.
// Older rows are kept (not deleted) so historical comment_classifications
// retain a valid bundle snapshot via post_context_bundles.creator_offer_snapshot.
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

    const body = await request.json().catch(() => ({}));
    const offerName =
      typeof body.offer_name === "string" ? body.offer_name.trim() : "";
    if (!offerName) {
      return NextResponse.json(
        { error: "offer_name is required" },
        { status: 400 }
      );
    }

    const payload = {
      creator_id: user.id,
      offer_name: offerName,
      offer_price_cents:
        typeof body.offer_price_cents === "number" &&
        Number.isFinite(body.offer_price_cents) &&
        body.offer_price_cents >= 0
          ? Math.round(body.offer_price_cents)
          : null,
      offer_url:
        typeof body.offer_url === "string" && body.offer_url.trim()
          ? body.offer_url.trim()
          : null,
      ideal_customer:
        typeof body.ideal_customer === "string" && body.ideal_customer.trim()
          ? body.ideal_customer.trim()
          : null,
      objections: Array.isArray(body.objections)
        ? body.objections.filter((s) => typeof s === "string" && s.trim())
        : null,
      qualification_questions: Array.isArray(body.qualification_questions)
        ? body.qualification_questions.filter(
            (s) => typeof s === "string" && s.trim()
          )
        : null,
      updated_at: new Date().toISOString(),
    };

    const admin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    const { error: deprecateErr } = await admin
      .from("creator_offers")
      .update({ deprecated_at: nowIso })
      .eq("creator_id", user.id)
      .is("deprecated_at", null);

    if (deprecateErr) {
      return NextResponse.json(
        { error: `Failed to deprecate prior offers: ${deprecateErr.message}` },
        { status: 500 }
      );
    }

    const { data: inserted, error: insertErr } = await admin
      .from("creator_offers")
      .insert(payload)
      .select(
        "id, offer_name, offer_price_cents, offer_url, ideal_customer, objections, qualification_questions"
      )
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: `Failed to save offer: ${insertErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ offer: inserted });
  } catch (err) {
    console.error("Offer save error:", err);
    return NextResponse.json(
      { error: "Failed to save offer." },
      { status: 500 }
    );
  }
}
