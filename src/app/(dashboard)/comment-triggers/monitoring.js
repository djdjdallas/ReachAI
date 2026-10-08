import { isUndefinedColumn } from "@/lib/db-errors";

// The picker's toggle state: ig_media_id → { enabled, actions_per_class,
// treatment_key }, joined through posts.
//
// treatment_key comes from migration 20261011120000. If the page is live
// before that migration runs, the select fails with 42703; retry without
// it (no tags) so every account still sees its watched posts.

const COLUMNS = "enabled, actions_per_class";

function query(admin, userId, monitoringCols) {
  return admin
    .from("posts")
    .select(`id, ig_media_id, post_monitoring_settings ( ${monitoringCols} )`)
    .eq("creator_id", userId)
    .not("ig_media_id", "is", null);
}

/**
 * @param {object} admin - service-role client
 * @param {string} userId
 * @returns {Promise<Record<string, {enabled: boolean, actions_per_class: object|null, treatment_key: string|null}>>}
 */
export async function loadMonitoringByMediaId(admin, userId) {
  let { data: postRows, error } = await query(admin, userId, `${COLUMNS}, treatment_key`);
  if (isUndefinedColumn(error)) {
    console.warn("[comment-triggers] treatment_key column missing (migration 20261011120000 not run); reading without it");
    ({ data: postRows } = await query(admin, userId, COLUMNS));
  }

  const out = {};
  for (const row of postRows || []) {
    if (!row?.ig_media_id) continue;
    const ms = Array.isArray(row.post_monitoring_settings)
      ? row.post_monitoring_settings[0]
      : row.post_monitoring_settings;
    if (ms) {
      out[row.ig_media_id] = {
        enabled: ms.enabled !== false,
        actions_per_class: ms.actions_per_class || null,
        treatment_key: ms.treatment_key || null,
      };
    }
  }
  return out;
}
