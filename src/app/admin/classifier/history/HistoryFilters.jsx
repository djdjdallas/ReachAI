import Link from "next/link";

export default function HistoryFilters({
  classOptions,
  currentClass,
  currentFrom,
  currentTo,
}) {
  return (
    <form
      method="GET"
      className="flex items-end gap-3 flex-wrap rounded-lg border border-stone-200 bg-white p-3"
    >
      <label className="flex flex-col text-xs text-stone-600">
        <span className="mb-1 font-semibold uppercase tracking-wide">
          Class
        </span>
        <select
          name="class"
          defaultValue={currentClass || ""}
          className="rounded border border-stone-300 px-2 py-1 text-sm bg-white"
        >
          <option value="">All</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col text-xs text-stone-600">
        <span className="mb-1 font-semibold uppercase tracking-wide">From</span>
        <input
          type="date"
          name="from"
          defaultValue={currentFrom || ""}
          className="rounded border border-stone-300 px-2 py-1 text-sm"
        />
      </label>

      <label className="flex flex-col text-xs text-stone-600">
        <span className="mb-1 font-semibold uppercase tracking-wide">To</span>
        <input
          type="date"
          name="to"
          defaultValue={currentTo || ""}
          className="rounded border border-stone-300 px-2 py-1 text-sm"
        />
      </label>

      <button
        type="submit"
        className="rounded bg-stone-900 text-white text-xs font-semibold px-3 py-2"
      >
        Apply
      </button>

      {(currentClass || currentFrom || currentTo) && (
        <Link
          href="/admin/classifier/history"
          className="text-xs text-stone-500 underline"
        >
          Reset
        </Link>
      )}
    </form>
  );
}
