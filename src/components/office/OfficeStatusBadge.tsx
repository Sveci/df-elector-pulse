import { Badge } from "@/components/ui/badge";
import type { OfficeVisitStatus } from "@/types/office";

const STATUS_CONFIG: Record<OfficeVisitStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  SCHEDULED: { label: "Agendada", variant: "outline" },
  REGISTERED: { label: "Registrado", variant: "secondary" },
  LINK_SENT: { label: "Link Enviado", variant: "default" },
  FORM_OPENED: { label: "Form Aberto", variant: "outline" },
  FORM_SUBMITTED: { label: "Form Enviado", variant: "default" },
  CHECKED_IN: { label: "Check-in Feito", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "destructive" },
  MEETING_COMPLETED: { label: "Reunião Realizada", variant: "default" },
  RESCHEDULED: { label: "Reagendada", variant: "secondary" }
};

interface OfficeStatusBadgeProps {
  status: OfficeVisitStatus;
  className?: string;
}

export function OfficeStatusBadge({ status, className }: OfficeStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  // Classe verde para reunião realizada
  const greenClass = status === "MEETING_COMPLETED"
    ? "bg-green-500 text-white hover:bg-green-600 border-transparent"
    : "";

  // Classe vermelha para reagendada
  const redClass = status === "RESCHEDULED"
    ? "bg-red-500 text-white hover:bg-red-600 border-transparent"
    : "";

  return (
    <Badge variant={config.variant} className={`${greenClass} ${redClass} ${className || ""}`}>
      {config.label}
    </Badge>
  );
}
