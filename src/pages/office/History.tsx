import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOfficeVisits } from "@/hooks/office/useOfficeVisits";
import { Loader2, Eye, ClipboardList } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OfficeStatusBadge } from "@/components/office/OfficeStatusBadge";
import { ProtocolBadge } from "@/components/office/ProtocolBadge";
import { VisitDetailsDialog } from "@/components/office/VisitDetailsDialog";
import { formatPhoneBR } from "@/services/office/officeService";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const historyTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="history-header"]',
    title: "Histórico de Visitas",
    content: "Consulte todas as visitas finalizadas ao gabinete. Visualize detalhes, atas de reunião e status.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="history-table"]',
    title: "Tabela de Visitas",
    content: "Veja protocolo, visitante, líder responsável, status e datas. Clique no ícone de olho para ver detalhes.",
    placement: "top",
  },
];

export default function History() {
  const { data: visits, isLoading } = useOfficeVisits();
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { restartTutorial } = useTutorial("office-history", historyTutorialSteps);

  // Filtrar apenas visitas finalizadas
  const finishedStatuses = ["MEETING_COMPLETED", "CANCELLED"];
  const finishedVisits = visits?.filter((v) => finishedStatuses.includes(v.status)) || [];

  const handleViewDetails = (visit: any) => {
    setSelectedVisit(visit);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <TutorialOverlay page="office-history" />
      <div data-tutorial="history-header" className="mb-6 flex items-center justify-between">
        <div>
          <PageHeader icon={ClipboardList} title="Histórico de Visitas" subtitle="Consulte todas as visitas registradas" />
        </div>
        <TutorialButton onClick={restartTutorial} />
      </div>

      <Card data-tutorial="history-table">
        <CardHeader>
          <CardTitle>Visitas Finalizadas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Líder</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data Registro</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finishedVisits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell>
                    <ProtocolBadge protocolo={visit.protocolo} showCopy={false} />
                  </TableCell>
                  <TableCell className="font-medium">
                    {visit.contact?.nome}
                  </TableCell>
                  <TableCell>
                    {visit.contact?.telefone_norm && formatPhoneBR(visit.contact.telefone_norm)}
                  </TableCell>
                  <TableCell>{visit.city?.nome}</TableCell>
                  <TableCell>{visit.leader?.nome_completo}</TableCell>
                  <TableCell>
                    <OfficeStatusBadge status={visit.status} />
                  </TableCell>
                  <TableCell>
                    {format(new Date(visit.created_at), "dd/MM/yyyy HH:mm", {
                      locale: ptBR
                    })}
                  </TableCell>
                  <TableCell>
                    {visit.checked_in_at ? (
                      format(new Date(visit.checked_in_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR
                      })
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(visit)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Ver detalhes</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
              {finishedVisits.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhuma visita finalizada ainda
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedVisit && (
        <VisitDetailsDialog
          visit={selectedVisit}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}
