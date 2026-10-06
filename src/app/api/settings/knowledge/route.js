import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getActiveOffer } from "@/lib/active-offer";
import {
  KNOWLEDGE_TOTAL_CAP,
  MAX_ENTRIES,
  totalChars,
  validateEntry,
} from "@/lib/knowledge/limits";
import { KNOWLEDGE_TEMPLATES } from "@/lib/knowledge/templates";

// /api/settings/knowledge — the only write path for knowledge_entries.
//
// Browser roles can read their own rows but cannot write the table
// (migration 20261008120000): every write lands here, is trimmed and
// validated (src/lib/knowledge/limits.js), and checked against the
// 15,000-character per-account cap before the service role writes it,
// always scoped to the signed-in user's id.
//
//   GET                         → { entries, totalChars, cap, offer, bookingLink }
//   POST   { entry }            → create one entry
//   POST   { template }         → add a vertical's starter drafts (disabled)
//   PATCH  { id, ...fields }    → update one entry
//   PATCH  { order: [ids] }     → reorder (sort = index)
//   DELETE ?id=                 → delete one entry

const FIELDS = "id, type, question, answer, enabled, sort, created_at, updated_at";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

async function loadEntries(admin, userId) {
  const { data, error } = await admin
    .from("knowledge_entries")
    .select(FIELDS)
    .eq("user_id", userId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`knowledge read failed: ${error.code}`);
  return data || [];
}

function overCap(total) {
  return bad(
    `That would put your business knowledge at ${total.toLocaleString()} characters. The limit is ${KNOWLEDGE_TOTAL_CAP.toLocaleString()}. Shorten or turn off another entry first.`,
    422
  );
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return unauthorized();
    const admin = getSupabaseAdmin();
    const [entries, offer, profile] = await Promise.all([
      loadEntries(admin, user.id),
      getActiveOffer(admin, user.id),
      admin.from("users").select("calendly_url").eq("id", user.id).maybeSingle(),
    ]);
    return NextResponse.json({
      entries,
      totalChars: totalChars(entries),
      cap: KNOWLEDGE_TOTAL_CAP,
      offer,
      bookingLink: profile?.data?.calendly_url || "",
    });
  } catch (err) {
    console.error("[knowledge] GET failed:", err?.message);
    return bad("Failed to load business knowledge", 500);
  }
}

export async function POST(request) {
  try {
    const user = await requireUser();
    if (!user) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const entries = await loadEntries(admin, user.id);
    const nextSort = entries.reduce((m, e) => Math.max(m, e.sort ?? 0), -1) + 1;

    if (typeof body.template === "string") {
      const template = Object.hasOwn(KNOWLEDGE_TEMPLATES, body.template)
        ? KNOWLEDGE_TEMPLATES[body.template]
        : null;
      if (!template) return bad("Unknown template");
      const rows = template.entries.map((t, i) => ({
        user_id: user.id,
        template_key: `${body.template}:${t.key}`,
        type: t.type,
        question: t.question,
        answer: "",
        enabled: false,
        sort: Math.min(nextSort + i, 10_000),
      }));
      // Upper bound: assumes none of these exist yet.
      if (entries.length + rows.length > MAX_ENTRIES) {
        return bad(`You can have up to ${MAX_ENTRIES} entries.`, 422);
      }
      // One statement; the unique (user_id, template_key) constraint skips
      // drafts this account already has, so concurrent clicks can't
      // duplicate them.
      const { data: added, error } = await admin
        .from("knowledge_entries")
        .upsert(rows, { onConflict: "user_id,template_key", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`template insert failed: ${error.code}`);
      return NextResponse.json({ added: added?.length ?? 0 });
    }

    const v = validateEntry(body.entry);
    if (!v.ok) return bad(v.error);
    if (entries.length + 1 > MAX_ENTRIES) {
      return bad(`You can have up to ${MAX_ENTRIES} entries.`, 422);
    }
    const row = { ...v.value, user_id: user.id, sort: v.value.sort ?? Math.min(nextSort, 10_000) };
    const total = totalChars([...entries, row]);
    if (total > KNOWLEDGE_TOTAL_CAP) return overCap(total);

    const { data, error } = await admin
      .from("knowledge_entries")
      .insert(row)
      .select(FIELDS)
      .single();
    if (error) throw new Error(`insert failed: ${error.code}`);
    return NextResponse.json({ entry: data });
  } catch (err) {
    console.error("[knowledge] POST failed:", err?.message);
    return bad("Failed to save", 500);
  }
}

export async function PATCH(request) {
  try {
    const user = await requireUser();
    if (!user) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const admin = getSupabaseAdmin();
    const entries = await loadEntries(admin, user.id);

    if (Array.isArray(body.order)) {
      const ids = body.order;
      const mine = new Set(entries.map((e) => e.id));
      if (
        ids.length !== entries.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => mine.has(id))
      ) {
        return bad("order must list each of your entries once");
      }
      for (let i = 0; i < ids.length; i++) {
        const { error } = await admin
          .from("knowledge_entries")
          .update({ sort: i })
          .eq("id", ids[i])
          .eq("user_id", user.id);
        if (error) throw new Error(`reorder failed: ${error.code}`);
      }
      return NextResponse.json({ ok: true });
    }

    const current = entries.find((e) => e.id === body.id);
    if (!current) return bad("Entry not found", 404);
    const { id: _id, ...fields } = body;
    const v = validateEntry(fields, { partial: true, current });
    if (!v.ok) return bad(v.error);

    const total = totalChars(
      entries.map((e) => (e.id === current.id ? { ...e, ...v.value } : e))
    );
    // Only refuse when the change adds characters: an account already over
    // the cap (e.g. after a race) can still shorten or disable entries.
    if (total > KNOWLEDGE_TOTAL_CAP && total > totalChars(entries)) return overCap(total);

    const { data, error } = await admin
      .from("knowledge_entries")
      .update(v.value)
      .eq("id", current.id)
      .eq("user_id", user.id)
      .select(FIELDS)
      .single();
    if (error) throw new Error(`update failed: ${error.code}`);
    return NextResponse.json({ entry: data });
  } catch (err) {
    console.error("[knowledge] PATCH failed:", err?.message);
    return bad("Failed to save", 500);
  }
}

export async function DELETE(request) {
  try {
    const user = await requireUser();
    if (!user) return unauthorized();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return bad("id is required");
    const { error } = await getSupabaseAdmin()
      .from("knowledge_entries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) throw new Error(`delete failed: ${error.code}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[knowledge] DELETE failed:", err?.message);
    return bad("Failed to delete", 500);
  }
}
