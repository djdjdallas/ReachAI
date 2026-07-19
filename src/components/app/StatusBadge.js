const STATUS_CONFIG = {
  new: { label: "NEW", className: "bg-stone-100 text-stone-500 ring-1 ring-stone-200" },
  qualifying: { label: "WARM LEAD", className: "bg-orange-50 text-orange-600 ring-1 ring-orange-100" },
  interested: { label: "HOT LEAD", className: "bg-red-50 text-red-600 ring-1 ring-red-100" },
  booked: { label: "BOOKED", className: "bg-green-50 text-green-600 ring-1 ring-green-100" },
  not_a_fit: { label: "COLD LEAD", className: "bg-stone-100 text-stone-400 ring-1 ring-stone-200" },
  "not a fit": { label: "COLD LEAD", className: "bg-stone-100 text-stone-400 ring-1 ring-stone-200" },
  manual: { label: "HUMAN", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-100" },
  human_takeover: { label: "HUMAN", className: "bg-purple-50 text-purple-600 ring-1 ring-purple-100" },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status?.toLowerCase()] || {
    label: status || "NEW",
    className: "bg-stone-100 text-stone-500",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${config.className}`}>
      {config.label}
    </span>
  );
}
