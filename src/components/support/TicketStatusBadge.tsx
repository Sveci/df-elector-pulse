import { Badge } from "@/components/ui/badge";

interface TicketStatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  aberto: { label: "Aberto", className: "bg-blue-100 text-blue-800 hover:bg-blue-100" },
  em_analise: { label: "Em Análise", className: "bg-amber-100 text-amber-800 hover:bg-amber-100" },
  respondido: { label: "Respondido", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  resolvido: { label: "Resolvido", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" },
  fechado: { label: "Fechado", className: "bg-gray-100 text-gray-800 hover:bg-gray-100" },
};

export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.aberto;

  return (
    <Badge variant="secondary" className={config.className}>
      {config.label}
    </Badge>
  );
}
