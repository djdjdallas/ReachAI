// In-memory stand-in for the supabase-js query builder with select, insert,
// upsert, update and delete, for tests of the outbound webhook helpers.
// Filters: eq, neq, is, in, lt, ilike (with % wildcards), not(col,'is',null).
// Modifiers: order (ignored unless asked), limit, single, maybeSingle.
// Each statement applies in one synchronous step, like a single SQL
// statement. Not a database: no constraints except an optional unique key
// per table for upsert/insert conflicts (onConflict may list several
// columns; ignoreDuplicates is honored).

function likeToRegex(pattern) {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "%") re += ".*";
    else if (c === "_") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

function matches(row, filters) {
  return filters.every(([op, col, val]) => {
    const v = row[col] ?? null;
    switch (op) {
      case "eq":
        return v === val;
      case "neq":
        return v !== val;
      case "is":
        return v === val;
      case "notnull":
        return v !== null;
      case "in":
        return val.includes(v);
      case "lt":
        return v !== null && v < val;
      case "ilike":
        return typeof v === "string" && likeToRegex(val).test(v);
      default:
        throw new Error(`fake-db: unsupported filter ${op}`);
    }
  });
}

function pick(row, cols) {
  if (!cols || cols.trim() === "*") return { ...row };
  return Object.fromEntries(
    cols
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => [c, row[c] ?? null])
  );
}

let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

/**
 * @param {Record<string, object[]>} tables
 * @param {{unique?: Record<string, string>, rpc?: Record<string, Function>, failOn?: Record<string, object|Function>}} [opts]
 *   unique: table → conflict column for insert/upsert
 *   failOn: table → error returned by every statement on that table, or a
 *     function (statement) → error|null to fail only some statements
 */
export function fakeDb(tables, opts = {}) {
  const calls = [];
  const db = {
    tables,
    calls,
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      const fn = opts.rpc?.[name];
      if (!fn) return { data: null, error: { message: `no rpc ${name}` } };
      return fn(args, tables);
    },
    from(table) {
      if (!tables[table]) tables[table] = [];
      const rows = tables[table];
      const st = { op: "select", cols: null, filters: [], limit: null, single: null, data: null, onConflict: null, returning: false };
      const builder = {
        select(cols = "*") {
          if (st.op === "select") st.cols = cols;
          else st.returning = cols;
          return builder;
        },
        insert(data) {
          st.op = "insert";
          st.data = data;
          return builder;
        },
        upsert(data, o = {}) {
          st.op = "upsert";
          st.data = data;
          st.onConflict = o.onConflict || null;
          st.ignoreDuplicates = o.ignoreDuplicates === true;
          return builder;
        },
        update(data) {
          st.op = "update";
          st.data = data;
          return builder;
        },
        delete() {
          st.op = "delete";
          return builder;
        },
        eq: (c, v) => (st.filters.push(["eq", c, v]), builder),
        neq: (c, v) => (st.filters.push(["neq", c, v]), builder),
        is: (c, v) => (st.filters.push(["is", c, v]), builder),
        in: (c, v) => (st.filters.push(["in", c, v]), builder),
        lt: (c, v) => (st.filters.push(["lt", c, v]), builder),
        ilike: (c, v) => (st.filters.push(["ilike", c, v]), builder),
        not: (c, op, v) => {
          if (op !== "is" || v !== null) throw new Error("fake-db: only not(col, 'is', null)");
          st.filters.push(["notnull", c]);
          return builder;
        },
        order: () => builder,
        limit: (n) => ((st.limit = n), builder),
        single: () => ((st.single = "single"), builder),
        maybeSingle: () => ((st.single = "maybe"), builder),
        then(resolve, reject) {
          try {
            resolve(run());
          } catch (err) {
            reject(err);
          }
        },
      };

      function shape(list, cols) {
        const out = list.map((r) => pick(r, cols));
        if (st.single === "single") {
          return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { code: "PGRST116", message: "not one row" } };
        }
        if (st.single === "maybe") {
          return out.length > 1 ? { data: null, error: { code: "PGRST116", message: "many rows" } } : { data: out[0] || null, error: null };
        }
        return { data: out, error: null };
      }

      function run() {
        calls.push({ table, op: st.op, data: st.data, filters: st.filters });
        const fail = typeof opts.failOn?.[table] === "function" ? opts.failOn[table](st) : opts.failOn?.[table];
        if (fail) return { data: null, error: fail };
        const uniq = st.onConflict || opts.unique?.[table];
        if (st.op === "select") {
          let hit = rows.filter((r) => matches(r, st.filters));
          if (st.limit != null) hit = hit.slice(0, st.limit);
          return shape(hit, st.cols);
        }
        if (st.op === "insert" || st.op === "upsert") {
          const list = Array.isArray(st.data) ? st.data : [st.data];
          const written = [];
          for (const d of list) {
            const keyCols = uniq ? uniq.split(",").map((c) => c.trim()) : [];
            const existing = uniq ? rows.find((r) => keyCols.every((c) => r[c] === d[c])) : null;
            if (existing) {
              if (st.op === "insert") return { data: null, error: { code: "23505", message: "duplicate key" } };
              if (st.ignoreDuplicates) continue;
              Object.assign(existing, d);
              written.push(existing);
            } else {
              const row = { id: newId(), ...d };
              rows.push(row);
              written.push(row);
            }
          }
          if (st.returning === false) return { data: null, error: null };
          return shape(written, st.returning);
        }
        if (st.op === "update") {
          const hit = rows.filter((r) => matches(r, st.filters));
          for (const r of hit) Object.assign(r, st.data);
          if (st.returning === false) return { data: null, error: null };
          return shape(hit, st.returning);
        }
        if (st.op === "delete") {
          const keep = rows.filter((r) => !matches(r, st.filters));
          const n = rows.length - keep.length;
          rows.splice(0, rows.length, ...keep);
          return { data: null, error: null, count: n };
        }
        throw new Error(`fake-db: unsupported op ${st.op}`);
      }

      return builder;
    },
  };
  return db;
}
