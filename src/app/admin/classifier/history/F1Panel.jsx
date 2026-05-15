// Aggregates feedback rows into per-class precision/recall/F1.
// Rows shape: [{ correct_class, comment_classifications: { class } }, ...]
// All math runs once over the array — no per-class queries.

function computeF1(rows, classes) {
  const counts = {};
  for (const cls of classes) counts[cls] = { tp: 0, fp: 0, fn: 0 };

  for (const r of rows) {
    const predicted = r?.comment_classifications?.class;
    const correct = r?.correct_class;
    if (!predicted || !correct) continue;
    if (predicted === correct) {
      if (counts[predicted]) counts[predicted].tp += 1;
    } else {
      if (counts[predicted]) counts[predicted].fp += 1;
      if (counts[correct]) counts[correct].fn += 1;
    }
  }

  return classes.map((cls) => {
    const { tp, fp, fn } = counts[cls];
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    const f1 =
      precision == null || recall == null || precision + recall === 0
        ? null
        : (2 * precision * recall) / (precision + recall);
    return { cls, tp, fp, fn, precision, recall, f1 };
  });
}

function fmtPct(value) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

export default function F1Panel({ rows, classes }) {
  const stats = computeF1(rows || [], classes);
  const totalLabeled = rows?.length || 0;

  return (
    <div className="rounded-lg border border-stone-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div>
          <h2 className="text-sm font-semibold">Per-class F1</h2>
          <p className="text-xs text-stone-500">
            Aggregated from {totalLabeled} feedback row
            {totalLabeled === 1 ? "" : "s"} with a correct class set.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Class</th>
              <th className="text-right px-3 py-2 font-medium">TP</th>
              <th className="text-right px-3 py-2 font-medium">FP</th>
              <th className="text-right px-3 py-2 font-medium">FN</th>
              <th className="text-right px-3 py-2 font-medium">Precision</th>
              <th className="text-right px-3 py-2 font-medium">Recall</th>
              <th className="text-right px-3 py-2 font-medium">F1</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-mono">
            {stats.map((s) => (
              <tr key={s.cls}>
                <td className="px-3 py-2 font-sans">{s.cls}</td>
                <td className="px-3 py-2 text-right">{s.tp}</td>
                <td className="px-3 py-2 text-right">{s.fp}</td>
                <td className="px-3 py-2 text-right">{s.fn}</td>
                <td className="px-3 py-2 text-right">{fmtPct(s.precision)}</td>
                <td className="px-3 py-2 text-right">{fmtPct(s.recall)}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {fmtPct(s.f1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
