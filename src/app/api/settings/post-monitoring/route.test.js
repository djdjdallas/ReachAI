import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeDb } from "@/lib/test-utils/fake-db";

// /api/settings/post-monitoring: the per-post treatment tag. Only persona
// accounts can set one, only to a key in their own list, and a save that
// doesn't mention it leaves it alone.

let db;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...db, auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => db }));
vi.mock("@/lib/comment-to-dm-gate", () => ({ canUseCommentToDM: () => true }));

const { POST } = await import("./route");

const TREATMENTS = [{ key: "botox", match: ["botox"] }, { key: "lip_filler", match: ["lips"], label: "lip filler" }];

function setup(user = {}, monitoring = []) {
  db = fakeDb({
    users: [{ id: "u1", email: "clinic@example.com", business_name: "Solé Aesthetics", treatment_categories: TREATMENTS, ...user }],
    posts: [{ id: "p1", creator_id: "u1", ig_media_id: "m1" }],
    post_monitoring_settings: monitoring,
  });
}

const post = (body) =>
  POST(new Request("http://x/api/settings/post-monitoring", { method: "POST", body: JSON.stringify({ ig_media_id: "m1", enabled: true, ...body }) }));

beforeEach(() => setup());

describe("POST /api/settings/post-monitoring treatment_key", () => {
  it("saves a key from the account's list", async () => {
    const res = await post({ treatment_key: "lip_filler" });
    expect(res.status).toBe(200);
    expect(db.tables.post_monitoring_settings[0]).toMatchObject({ post_id: "p1", treatment_key: "lip_filler" });
  });

  it("rejects a key not in the list", async () => {
    const res = await post({ treatment_key: "laser" });
    expect(res.status).toBe(400);
    expect(db.tables.post_monitoring_settings).toHaveLength(0);
  });

  it("rejects any key on a coach account", async () => {
    setup({ business_name: null });
    expect((await post({ treatment_key: "botox" })).status).toBe(400);
  });

  it("null clears the tag", async () => {
    setup({}, [{ id: "ms1", creator_id: "u1", post_id: "p1", enabled: true, treatment_key: "botox" }]);
    await post({ treatment_key: null });
    expect(db.tables.post_monitoring_settings[0].treatment_key).toBeNull();
  });

  it("a save without the field leaves the tag alone", async () => {
    setup({}, [{ id: "ms1", creator_id: "u1", post_id: "p1", enabled: true, treatment_key: "botox" }]);
    await post({ enabled: false });
    expect(db.tables.post_monitoring_settings[0]).toMatchObject({ enabled: false, treatment_key: "botox" });
  });
});
