import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupportTickets } from "@/hooks/support/useSupportTickets";
import { CreateTicketDialog } from "@/components/support/CreateTicketDialog";
import { TicketDetailsDialog } from "@/components/support/TicketDetailsDialog";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { TicketPriorityBadge } from "@/components/support/TicketPriorityBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Ticket, Loader2 } from "lucide-react";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const supportTutorialSteps: Step[] = [
  { target: '[data-tutorial="sup-header"]', title: 'Suporte', content: 'Abra tickets para reportar problemas ou tirar dúvidas.' },
  { target: '[data-tutorial="sup-create"]', title: 'Abrir Ticket', content: 'Crie um novo chamado de suporte.' },
  { target: '[data-tutorial="sup-list"]', title: 'Seus Tickets', content: 'Lista de todos os tickets com status e prioridade.' },
  { target: '[data-tutorial="sup-details"]', title: 'Detalhes', content: 'Clique em um ticket para ver detalhes e respostas.' },
];

const Support = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { restartTutorial } = useTutorial("support", supportTutorialSteps);

  const { data: tickets, isLoading } = useSupportTickets();

  // Abrir modal automaticamente se tiver ticket na URL
  useEffect(() => {
    const ticketId = searchParams.get('ticket');
    if (ticketId) {
      setSelectedTicketId(ticketId);
      setDetailsDialogOpen(true);
      // Limpar query param
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailsDialogOpen(true);
  };

  const categoriaLabels: Record<string, string> = {
    bug: "Bug / Erro",
    duvida: "Dúvida",
    sugestao: "Sugestão",
    outro: "Outro",
  };

  return (
    <DashboardLayout>
      <TutorialOverlay page="support" />
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6" data-tutorial="sup-header">
          <PageHeader icon={HelpCircle} title="Suporte" subtitle="Abra tickets para reportar problemas ou tirar dúvidas" dataTutorial="sup-header" />
          <div className="flex items-center gap-2">
            <TutorialButton onClick={restartTutorial} />
            <Button onClick={() => setCreateDialogOpen(true)} data-tutorial="sup-create">
              <Plus className="h-4 w-4 mr-2" />
              Abrir Ticket
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets && tickets.length > 0 ? (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleTicketClick(ticket.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">
                          {ticket.protocolo}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          • {categoriaLabels[ticket.categoria] || ticket.categoria}
                        </span>
                      </div>
                      <h3 className="font-medium truncate">{ticket.assunto}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {ticket.descricao}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Criado em {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <TicketStatusBadge status={ticket.status} />
                      <TicketPriorityBadge prioridade={ticket.prioridade} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Ticket className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-1">Nenhum ticket aberto</h3>
              <p className="text-muted-foreground text-sm text-center mb-4">
                Você ainda não abriu nenhum ticket de suporte.
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Abrir Primeiro Ticket
              </Button>
            </CardContent>
          </Card>
        )}

        <CreateTicketDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        <TicketDetailsDialog
          ticketId={selectedTicketId}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />
      </div>
    </DashboardLayout>
  );
};

export default Support;
