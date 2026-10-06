import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { compareDefinerGrants } from "./definer-grants";

const row = (signature, anon, auth) => ({
  signature,
  anon_can_execute: anon,
  authenticated_can_execute: auth,
});

describe("compareDefinerGrants (audit H1 guard)", () => {
  it("nothing exposed passes", () => {
    expect(compareDefinerGrants([], [])).toEqual({ violations: [], stale: [] });
  });

  it("an exposed definer function with no allowlist entry fails, per role", () => {
    const { violations } = compareDefinerGrants([row("increment_dm_count(uid uuid)", true, true)], []);
    expect(violations).toEqual([
      "increment_dm_count(uid uuid) is executable by anon",
      "increment_dm_count(uid uuid) is executable by authenticated",
    ]);
  });

  it("allowlisting authenticated does not allow anon", () => {
    const { violations } = compareDefinerGrants(
      [row("my_fn(x uuid)", true, true)],
      [{ signature: "my_fn(x uuid)", roles: ["authenticated"], reason: "test" }]
    );
    expect(violations).toEqual(["my_fn(x uuid) is executable by anon"]);
  });

  it("an allowlisted exposure passes; the signature must match exactly", () => {
    const allow = [{ signature: "my_fn(x uuid)", roles: ["authenticated"], reason: "test" }];
    expect(compareDefinerGrants([row("my_fn(x uuid)", false, true)], allow).violations).toEqual([]);
    // Same name, new overload: not covered.
    expect(compareDefinerGrants([row("my_fn(x uuid, y text)", false, true)], allow).violations).toHaveLength(1);
  });

  it("reports allowlist entries that are no longer exposed, without failing", () => {
    const r = compareDefinerGrants([], [{ signature: "gone()", roles: ["anon"], reason: "old" }]);
    expect(r).toEqual({ violations: [], stale: ["gone()"] });
  });

  it("the checked-in allowlist is well formed (and empty today)", () => {
    const file = JSON.parse(
      readFileSync(new URL("../../../scripts/definer-grants-allowlist.json", import.meta.url), "utf8")
    );
    expect(Array.isArray(file.allowed)).toBe(true);
    for (const e of file.allowed) {
      expect(typeof e.signature).toBe("string");
      expect(e.roles.every((r) => r === "anon" || r === "authenticated")).toBe(true);
      expect(e.reason).toBeTruthy();
    }
    expect(file.allowed).toEqual([]);
  });

  it("every SECURITY DEFINER function a migration creates is revoked from the browser somewhere", () => {
    // Static backstop for the live check: CI without database secrets still
    // catches a new definer function that forgot its revoke.
    const dir = new URL("../../../supabase/migrations/", import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const sql = files.map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n").toLowerCase();
    const defined = new Set();
    const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\)\s*returns[\s\S]*?(?:\$\$|\$[a-z_]*\$|;)/g;
    for (const m of sql.matchAll(re)) {
      const head = sql.slice(m.index, m.index + 2000).split(/\$\$|\$[a-z_]*\$/)[0];
      if (/security\s+definer/.test(head)) defined.add(m[1]);
    }
    const allowed = new Set(
      JSON.parse(readFileSync(new URL("../../../scripts/definer-grants-allowlist.json", import.meta.url), "utf8"))
        .allowed.map((e) => e.signature.split("(")[0])
    );
    const unrevoked = [...defined].filter(
      (fn) =>
        !allowed.has(fn) &&
        !new RegExp(`revoke\\s+(?:all|execute)[\\s\\S]{0,40}?on\\s+function\\s+(?:public\\.)?${fn}\\s*\\(`).test(sql)
    );
    expect(unrevoked).toEqual([]);
  });
});
