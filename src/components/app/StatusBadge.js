import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG = {
  qualifying: { label: "Qualifying", variant: "warning" },
  interested: { label: "Interested", className: "bg-blue-500/15 text-blue-600 border-transparent" },
  booked: { label: "Booked", variant: "success" },
  not_a_fit: { label: "Not a Fit", variant: "muted" },
  "not a fit": { label: "Not a Fit", variant: "muted" },
  manual: { label: "Human Takeover", className: "bg-orange-500/15 text-orange-600 border-transparent" },
  human_takeover: { label: "Human Takeover", className: "bg-orange-500/15 text-orange-600 border-transparent" },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status?.toLowerCase()] || {
    label: status || "New",
    variant: "default",
  };

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
