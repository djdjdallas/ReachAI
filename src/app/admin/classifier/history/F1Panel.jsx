// Renders per-class precision/recall/F1 from the aggregated confusion
// matrix returned by the classifier_confusion_matrix RPC.
// Rows shape: [{ predicted, actual, n }, ...]
// All math is constant-time over the matrix size (≤ 7×7), no per-row work.

function computeF1(matrix, classes) {
  const counts = {};
  let totalLabeled = 0;
  for (const cls of classes) counts[cls] = { tp: 0, fp: 0, fn: 0 };

  for (const cell of matrix || []) {
    const predicted = cell?.predicted;
    const actual = cell?.actual;
    const n = Number(cell?.n) || 0;
    if (!predicted || !actual || n === 0) continue;
    totalLabeled += n;
    if (predicted === actual) {
      if (counts[predicted]) counts[predicted].tp += n;
    } else {
      if (counts[predicted]) counts[predicted].fp += n;
      if (counts[actual]) counts[actual].fn += n;
    }
  }

  const stats = classes.map((cls) => {
    const { tp, fp, fn } = counts[cls];
    const precision = tp + fp === 0 ? null : tp / (tp + fp);
    const recall = tp + fn === 0 ? null : tp / (tp + fn);
    const f1 =
      precision == null || recall == null || precision + recall === 0
        ? null
        : (2 * precision * recall) / (precision + recall);
    return { cls, tp, fp, fn, precision, recall, f1 };
  });

  return { stats, totalLabeled };
}

function fmtPct(value) {
  if (value == null) return "—";
  return `${(value * 100).toFixed(0)}%`;
}

export default function F1Panel({ rows, classes }) {
  // `rows` is the confusion matrix from the RPC. Older callers passed raw
  // feedback rows; the API surface is intentionally the same parameter
  // name so the page just swaps its data source.
  const { stats, totalLabeled } = computeF1(rows || [], classes);

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
