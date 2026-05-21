export default function ComingSoonBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full bg-[#fff5f2] text-[#ff7e67] text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      Coming Soon
    </span>
  );
}
