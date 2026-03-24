export default function ComparisonTable({ rows, competitorName }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left py-4 px-6 text-sm font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
              Feature
            </th>
            <th className="text-left py-4 px-6 text-sm font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
              {competitorName}
            </th>
            <th className="text-left py-4 px-6 text-sm font-bold uppercase tracking-wider text-[#ff7e67] border-b border-[#ff7e67]/20 bg-[#fff5f2] rounded-t-xl">
              Clinchd
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.feature}
              className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}
            >
              <td className="py-4 px-6 text-sm font-bold text-stone-900 border-b border-stone-50">
                {row.feature}
              </td>
              <td className="py-4 px-6 text-sm text-stone-500 border-b border-stone-50">
                {row.competitor}
              </td>
              <td className="py-4 px-6 text-sm font-semibold text-stone-900 border-b border-[#ff7e67]/10 bg-[#fff5f2]/50">
                {row.clinchd}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
