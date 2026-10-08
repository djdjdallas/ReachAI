// Leaf module, no imports. Postgres error checks shared by reads that must
// keep working across a deploy.

/**
 * Postgres 42703 (undefined_column), as PostgREST returns it when a select
 * names a column the database doesn't have yet. Lets a read that includes
 * a column from a pending migration retry without it instead of failing
 * (the code ships before the migration is run, or the migration is late).
 *
 * @param {{code?: string}|null|undefined} error
 * @returns {boolean}
 */
export function isUndefinedColumn(error) {
  return error?.code === "42703";
}
