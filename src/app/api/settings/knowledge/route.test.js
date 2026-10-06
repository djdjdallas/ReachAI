import { describe, it, expect, vi, beforeEach } from "vitest";
import { totalChars } from "@/lib/knowledge/limits";

// /api/settings/knowledge: the only write path for knowledge_entries.
// Validation, the 15k per-account cap, and per-user scoping are all enforced
// here, server-side. An in-memory table stands in for Supabase.

const store = { rows: [], userId: "user-1" };
const writes = [];

function admin() {
  return {
    from(table) {
      const q = { table, op: "select", payload: null, filters: [] };
      const b = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") return (resolve) => resolve(run(q));
            if (["insert", "update", "delete"].includes(prop)) {
              return (payload) => ((q.op = prop), (q.payload = payload), b);
            }
            if (prop === "upsert") {
              return (payload, opts) => ((q.op = "upsert"), (q.payload = payload), (q.opts = opts), b);
            }
            if (prop === "eq") return (c, v) => (q.filters.push([c, v]), b);
            if (prop === "single" || prop === "maybeSingle") return () => ((q.single = true), b);
            return () => b;
          },
        }
      );
      return b;
    },
  };
}

function matches(row, filters) {
  return filters.every(([c, v]) => row[c] === v);
}

function run(q) {
  if (q.table === "users") return { data: { calendly_url: "https://cal.test/me" }, error: null };
  if (q.table !== "knowledge_entries") return { data: null, error: null };
  if (q.op !== "select") writes.push({ op: q.op, payload: q.payload, filters: q.filters });
  if (q.op === "select") {
    const rows = store.rows.filter((r) => matches(r, q.filters)).sort((a, b) => a.sort - b.sort);
    return { data: rows, error: null };
  }
  if (q.op === "insert") {
    const list = (Array.isArray(q.payload) ? q.payload : [q.payload]).map((r, i) => ({
      id: `new-${store.rows.length + i}`,
      created_at: new Date().toISOString(),
      ...r,
    }));
    store.rows.push(...list);
    return { data: q.single ? list[0] : list, error: null };
  }
  if (q.op === "upsert") {
    // Mirrors unique (user_id, template_key) with ignoreDuplicates.
    expect(q.opts).toEqual({ onConflict: "user_id,template_key", ignoreDuplicates: true });
    const added = [];
    for (const r of q.payload) {
      const dup = store.rows.some((x) => x.user_id === r.user_id && x.template_key === r.template_key);
      if (dup) continue;
      const row = { id: `new-${store.rows.length}`, created_at: new Date().toISOString(), ...r };
      store.rows.push(row);
      added.push({ id: row.id });
    }
    return { data: added, error: null };
  }
  if (q.op === "update") {
    const hit = store.rows.filter((r) => matches(r, q.filters));
    hit.forEach((r) => Object.assign(r, q.payload));
    return { data: q.single ? hit[0] || null : hit, error: null };
  }
  if (q.op === "delete") {
    store.rows = store.rows.filter((r) => !matches(r, q.filters));
    return { data: null, error: null };
  }
  return { data: null, error: null };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () =>
        store.userId
          ? { data: { user: { id: store.userId } }, error: null }
          : { data: { user: null }, error: { message: "no session" } },
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => admin() }));
vi.mock("@/lib/active-offer", () => ({
  getActiveOffer: async () => ({ offer_name: "12 weeks", offer_price_cents: 30000 }),
}));

const { GET, POST, PATCH, DELETE } = await import("./route");

const req = (method, body, query = "") =>
  new Request(`https://app.test/api/settings/knowledge${query}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });

const row = (over) => ({
  id: over.id,
  user_id: "user-1",
  type: "faq",
  question: "q",
  answer: "a",
  enabled: true,
  sort: 0,
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

beforeEach(() => {
  store.rows = [];
  store.userId = "user-1";
  writes.length = 0;
});

describe("auth", () => {
  it.each([
    ["GET", () => GET()],
    ["POST", () => POST(req("POST", { entry: {} }))],
    ["PATCH", () => PATCH(req("PATCH", { id: "x" }))],
    ["DELETE", () => DELETE(req("DELETE", null, "?id=x"))],
  ])("%s without a session is 401 and writes nothing", async (_m, call) => {
    store.userId = null;
    expect((await call()).status).toBe(401);
    expect(writes).toHaveLength(0);
  });
});

describe("GET", () => {
  it("returns only the caller's entries, the meter total, and the offer card", async () => {
    store.rows = [
      row({ id: "mine", question: "ab", answer: "cd" }),
      row({ id: "theirs", user_id: "user-2", question: "secret", answer: "other account" }),
    ];
    const data = await (await GET()).json();
    expect(data.entries.map((e) => e.id)).toEqual(["mine"]);
    expect(data.totalChars).toBe(totalChars([store.rows[0]]));
    expect(data.cap).toBe(15000);
    expect(data.offer.offer_name).toBe("12 weeks");
    expect(data.bookingLink).toBe("https://cal.test/me");
  });
});

describe("POST create", () => {
  it("trims and stores an entry for the signed-in user only", async () => {
    const res = await POST(
      req("POST", { entry: { type: "faq", question: "  Hours? ", answer: " 9-5 ", enabled: true, user_id: "user-2" } })
    );
    expect(res.status).toBe(200);
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ user_id: "user-1", question: "Hours?", answer: "9-5", enabled: true });
  });

  it("rejects invalid input with 400", async () => {
    const res = await POST(req("POST", { entry: { type: "faq", question: "q", answer: "", enabled: true } }));
    expect(res.status).toBe(400);
    expect(store.rows).toHaveLength(0);
  });

  it("enforces the 15,000-character cap server-side", async () => {
    store.rows = Array.from({ length: 7 }, (_, i) =>
      row({ id: `r${i}`, sort: i, question: "q", answer: "x".repeat(1999) })
    ); // 14,000
    const res = await POST(
      req("POST", { entry: { type: "faq", question: "one more", answer: "y".repeat(1500), enabled: true } })
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/15,000/);
    expect(store.rows).toHaveLength(7);
  });

  it("a disabled draft doesn't count against the cap", async () => {
    store.rows = Array.from({ length: 7 }, (_, i) =>
      row({ id: `r${i}`, sort: i, question: "q", answer: "x".repeat(2000) })
    );
    const res = await POST(
      req("POST", { entry: { type: "faq", question: "draft", answer: "y".repeat(1500), enabled: false } })
    );
    expect(res.status).toBe(200);
  });
});

describe("POST template", () => {
  it("adds the vertical's questions as disabled empty drafts, once", async () => {
    const first = await (await POST(req("POST", { template: "med_spa" }))).json();
    expect(first.added).toBe(6);
    expect(store.rows.every((r) => r.enabled === false && r.answer === "" && r.user_id === "user-1")).toBe(true);
    expect(store.rows.map((r) => r.template_key)).toContain("med_spa:pricing");
    // Even after the owner edits a draft's question, re-adding skips it.
    store.rows[0].question = "Edited question";
    const again = await (await POST(req("POST", { template: "med_spa" }))).json();
    expect(again.added).toBe(0);
    expect(store.rows.length).toBe(6);
  });

  it("two clicks at once still add each draft once (one upsert per click)", async () => {
    await Promise.all([POST(req("POST", { template: "coaching" })), POST(req("POST", { template: "coaching" }))]);
    expect(store.rows.length).toBe(6);
  });

  it("an entry body can't set template_key", async () => {
    await POST(req("POST", { entry: { type: "faq", question: "q", answer: "a", template_key: "coaching:included" } }));
    expect(store.rows[0].template_key).toBeUndefined();
  });

  it.each(["dentist", "__proto__", "toString"])("rejects unknown template %j", async (t) => {
    expect((await POST(req("POST", { template: t }))).status).toBe(400);
  });
});

describe("PATCH", () => {
  it("turning on an entry that would cross the cap is refused", async () => {
    store.rows = [
      ...Array.from({ length: 7 }, (_, i) => row({ id: `r${i}`, sort: i, answer: "x".repeat(1999) })),
      row({ id: "draft", sort: 8, enabled: false, answer: "y".repeat(1500) }),
    ];
    const res = await PATCH(req("PATCH", { id: "draft", enabled: true }));
    expect(res.status).toBe(422);
    expect(store.rows.find((r) => r.id === "draft").enabled).toBe(false);
  });

  it("an account already over the cap can still shorten or disable", async () => {
    store.rows = Array.from({ length: 8 }, (_, i) => row({ id: `r${i}`, sort: i, answer: "x".repeat(1999) }));
    expect((await PATCH(req("PATCH", { id: "r0", enabled: false }))).status).toBe(200);
  });

  it("cannot reach another user's entry", async () => {
    store.rows = [row({ id: "theirs", user_id: "user-2" })];
    const res = await PATCH(req("PATCH", { id: "theirs", answer: "hijacked" }));
    expect(res.status).toBe(404);
    expect(store.rows[0].answer).toBe("a");
  });

  it("validates the merged row (can't enable an empty draft)", async () => {
    store.rows = [row({ id: "d", enabled: false, answer: "" })];
    expect((await PATCH(req("PATCH", { id: "d", enabled: true }))).status).toBe(400);
  });

  it("reorders only with a complete list of the caller's ids", async () => {
    store.rows = [row({ id: "a", sort: 0 }), row({ id: "b", sort: 1 })];
    expect((await PATCH(req("PATCH", { order: ["b"] }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { order: ["b", "x"] }))).status).toBe(400);
    expect((await PATCH(req("PATCH", { order: ["b", "a"] }))).status).toBe(200);
    expect(store.rows.find((r) => r.id === "b").sort).toBe(0);
    expect(writes.every((w) => w.filters.some(([c, v]) => c === "user_id" && v === "user-1"))).toBe(true);
  });
});

describe("DELETE", () => {
  it("deletes only the caller's row", async () => {
    store.rows = [row({ id: "same", user_id: "user-2" })];
    await DELETE(req("DELETE", null, "?id=same"));
    expect(store.rows).toHaveLength(1);
    store.rows.push(row({ id: "mine" }));
    await DELETE(req("DELETE", null, "?id=mine"));
    expect(store.rows.map((r) => r.id)).toEqual(["same"]);
  });
});
