import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Drip template CRUD. Mirrors src/lib/voice/snippets.js: one active template
// per (user_id, intent_class), enforced at the DB layer by the partial unique
// index dm_drip_templates_active_per_class. We deactivate the existing active
// row before inserting so the insert doesn't race the index.

/**
 * Lists all drip templates owned by a user, newest first.
 */
export async function listDripTemplates(userId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dm_drip_templates")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`listDripTemplates failed: ${error.message}`);
  }
  return data || [];
}

/**
 * Creates a new drip template and atomically deactivates any other active
 * template for the same (user_id, intent_class). On unique-index conflict
 * (a racing insert) surfaces a 409.
 */
export async function createDripTemplate({ userId, intentClass, label, content }) {
  const supabase = getSupabaseAdmin();

  const { error: deactivateErr } = await supabase
    .from("dm_drip_templates")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("intent_class", intentClass)
    .eq("is_active", true);

  if (deactivateErr) {
    throw new Error(
      `createDripTemplate deactivate-existing failed: ${deactivateErr.message}`
    );
  }

  const { data, error } = await supabase
    .from("dm_drip_templates")
    .insert({
      user_id: userId,
      intent_class: intentClass,
      label,
      content,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    const isUniqueConflict =
      error.code === "23505" ||
      (typeof error.message === "string" &&
        error.message.includes("dm_drip_templates_active_per_class"));
    if (isUniqueConflict) {
      const conflict = new Error(
        "Another active follow-up exists for this intent. Retry after deactivating it."
      );
      conflict.status = 409;
      throw conflict;
    }
    throw new Error(`createDripTemplate insert failed: ${error.message}`);
  }

  return data;
}

/**
 * Updates content/label/isActive on a template. When activating, deactivates
 * any other active template for the same (user_id, intent_class).
 */
export async function updateDripTemplate(userId, templateId, { content, label, isActive }) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupErr } = await supabase
    .from("dm_drip_templates")
    .select("*")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`updateDripTemplate lookup failed: ${lookupErr.message}`);
  }
  if (!existing) {
    const notFound = new Error("Template not found");
    notFound.status = 404;
    throw notFound;
  }

  if (isActive === true) {
    const { error: deactivateErr } = await supabase
      .from("dm_drip_templates")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("intent_class", existing.intent_class)
      .eq("is_active", true)
      .neq("id", templateId);
    if (deactivateErr) {
      throw new Error(
        `updateDripTemplate deactivate-siblings failed: ${deactivateErr.message}`
      );
    }
  }

  const patch = {};
  if (typeof content === "string") patch.content = content;
  if (typeof label === "string") patch.label = label;
  if (typeof isActive === "boolean") patch.is_active = isActive;

  const { data, error } = await supabase
    .from("dm_drip_templates")
    .update(patch)
    .eq("id", templateId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    const isUniqueConflict =
      error.code === "23505" ||
      (typeof error.message === "string" &&
        error.message.includes("dm_drip_templates_active_per_class"));
    if (isUniqueConflict) {
      const conflict = new Error(
        "Another active follow-up exists for this intent. Retry after deactivating it."
      );
      conflict.status = 409;
      throw conflict;
    }
    throw new Error(`updateDripTemplate update failed: ${error.message}`);
  }
  return data;
}

/**
 * Deletes a drip template. Any queued drip rows that captured this template_id
 * keep their FK NULLed (ON DELETE SET NULL); the processor treats a missing
 * template as a skip.
 */
export async function deleteDripTemplate(userId, templateId) {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: lookupErr } = await supabase
    .from("dm_drip_templates")
    .select("id")
    .eq("id", templateId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupErr) {
    throw new Error(`deleteDripTemplate lookup failed: ${lookupErr.message}`);
  }
  if (!existing) {
    const notFound = new Error("Template not found");
    notFound.status = 404;
    throw notFound;
  }

  const { error } = await supabase
    .from("dm_drip_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`deleteDripTemplate delete failed: ${error.message}`);
  }
  return { id: templateId };
}

/**
 * Returns the active template for (userId, intentClass) or null. Used by the
 * queue at enqueue time to capture template_id, and is safe for the processor.
 */
export async function getActiveTemplate(userId, intentClass) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("dm_drip_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("intent_class", intentClass)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    console.warn("[drip/templates] getActiveTemplate lookup failed:", error.message);
    return null;
  }
  return data || null;
}
