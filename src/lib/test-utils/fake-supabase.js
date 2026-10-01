// Minimal in-memory stand-in for the supabase-js query builder, for tests of
// helpers that take a client. Supports the chains the Stripe webhook helpers
// use: from().update().eq/neq/is/not().select(), awaited directly. Each
// update applies its filters and writes in one synchronous step, the way a
// single UPDATE ... WHERE is atomic in Postgres, so two concurrent calls race
// the same way two webhook deliveries would.

function matches(row, filters) {
  return filters.every(([op, col, val]) => {
    if (op === "eq") return row[col] === val;
    if (op === "neq") return row[col] !== val;
    if (op === "is") return (row[col] ?? null) === val;
    if (op === "notnull") return (row[col] ?? null) !== null;
    throw new Error(`fake-supabase: unsupported filter ${op}`);
  });
}

function pick(row, cols) {
  if (!cols || cols === "*") return { ...row };
  return Object.fromEntries(
    cols.split(",").map((c) => c.trim()).map((c) => [c, row[c] ?? null])
  );
}

export function fakeSupabase(tables) {
  const calls = [];
  return {
    tables,
    calls,
    from(table) {
      const rows = tables[table];
      if (!rows) throw new Error(`fake-supabase: no table ${table}`);
      return {
        update(data) {
          const filters = [];
          let selectCols = null;
          const builder = {
            eq: (c, v) => (filters.push(["eq", c, v]), builder),
            neq: (c, v) => (filters.push(["neq", c, v]), builder),
            is: (c, v) => (filters.push(["is", c, v]), builder),
            not: (c, op, v) => {
              if (op !== "is" || v !== null) throw new Error("fake-supabase: only not(col, 'is', null)");
              filters.push(["notnull", c]);
              return builder;
            },
            select: (cols) => ((selectCols = cols), builder),
            then(resolve, reject) {
              try {
                const hit = rows.filter((r) => matches(r, filters));
                for (const r of hit) Object.assign(r, data);
                calls.push({ table, data, filters, matched: hit.length });
                resolve({
                  data: selectCols === null ? null : hit.map((r) => pick(r, selectCols)),
                  error: null,
                });
              } catch (err) {
                reject(err);
              }
            },
          };
          return builder;
        },
      };
    },
  };
}
