// Minimal supabase-js stand-in for the Stripe webhook route tests (shared by
// route.test.js and route.side-effects.test.js). Every query applies its filters and writes in
// one synchronous step, the way a single UPDATE ... WHERE is atomic in
// Postgres. `failOn` injects an error for a given table + operation (a
// message, or a function of the update data returning one);
// `afterRead` runs once after the first users read, to model a concurrent
// write landing between the handler's read and its UPDATE.
export function fakeDb(tables, { failOn = {}, afterRead } = {}) {
  let readHook = afterRead;
  const parseOr = (expr) =>
    expr.split(",").map((part) => {
      const [col, op, ...rest] = part.split(".");
      const val = rest.join(".");
      return (row) =>
        op === "is" && val === "null" ? (row[col] ?? null) === null : op === "eq" && row[col] === val;
    });
  const matches = (row, filters) =>
    filters.every(([op, col, val]) => {
      if (op === "eq") return row[col] === val;
      if (op === "neq") return row[col] !== val;
      if (op === "is") return (row[col] ?? null) === val;
      if (op === "notnull") return (row[col] ?? null) !== null;
      if (op === "lt") return row[col] != null && row[col] < val;
      if (op === "or") return parseOr(col).some((m) => m(row));
      throw new Error(`unsupported filter ${op}`);
    });

  return {
    tables,
    from(table) {
      const rows = (tables[table] ||= []);
      const query = (kind, data) => {
        const filters = [];
        let single = false;
        let selected = kind === "select";
        const run = () => {
          const rule = failOn[`${table}.${kind}`];
          const failure = typeof rule === "function" ? rule(data) : rule;
          if (failure) return { data: null, error: { message: failure } };
          const hit = rows.filter((r) => matches(r, filters));
          if (kind === "update") for (const r of hit) Object.assign(r, data);
          if (kind === "delete") {
            for (const r of hit) rows.splice(rows.indexOf(r), 1);
            return { data: null, error: null };
          }
          if (kind === "select" && table === "users" && readHook) {
            const snapshot = hit.map((r) => ({ ...r }));
            readHook(tables);
            readHook = null;
            return { data: single ? snapshot[0] ?? null : snapshot, error: null, count: hit.length };
          }
          const out = selected ? hit.map((r) => ({ ...r })) : null;
          return { data: single ? out?.[0] ?? null : out, error: null, count: hit.length };
        };
        const b = {
          eq: (c, v) => (filters.push(["eq", c, v]), b),
          neq: (c, v) => (filters.push(["neq", c, v]), b),
          is: (c, v) => (filters.push(["is", c, v]), b),
          lt: (c, v) => (filters.push(["lt", c, v]), b),
          not: (c, _op, _v) => (filters.push(["notnull", c]), b),
          or: (expr) => (filters.push(["or", expr]), b),
          select: () => ((selected = true), b),
          maybeSingle: () => ((single = true), Promise.resolve(run())),
          single: () => ((single = true), Promise.resolve(run())),
          then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
        };
        return b;
      };
      return {
        select: () => query("select"),
        update: (data) => query("update", data),
        delete: () => query("delete"),
        // insert ... on conflict do nothing: returns only the rows inserted.
        upsert: (data, { onConflict } = {}) => {
          const rule = failOn[`${table}.upsert`];
          const list = Array.isArray(data) ? data : [data];
          const inserted = [];
          if (!rule) {
            for (const r of list) {
              if (!rows.some((x) => x[onConflict] === r[onConflict])) {
                rows.push({ ...r });
                inserted.push({ ...r });
              }
            }
          }
          const result = rule ? { data: null, error: { message: rule } } : { data: inserted, error: null };
          const b = { select: () => b, then: (res, rej) => Promise.resolve(result).then(res, rej) };
          return b;
        },
      };
    },
  };
}

