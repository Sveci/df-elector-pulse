import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllTickets, useTicketStats, useUpdateTicketStatus } from "@/hooks/support/useAdminTickets";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { TicketDetailsDialog } from "@/components/support/TicketDetailsDialog";
import { TicketStatusBadge } from "@/components/support/TicketStatusBadge";
import { TicketPriorityBadge } from "@/components/support/TicketPriorityBadge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Loader2, Ticket, CheckCircle, Clock, MessageCircle, XCircle, AlertTriangle } from "lucide-react";
import { Navigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const adminTicketsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="admin-tickets-header"]',
    title: "Administrar Tickets",
    content: "Gerencie todos os tickets de suporte abertos pelos usuários do sistema.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="admin-tickets-stats"]',
    title: "Estatísticas",
    content: "Acompanhe quantos tickets estão abertos, em análise, respondidos, resolvidos e fechados.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="admin-tickets-filters"]',
    title: "Filtros",
    content: "Busque por protocolo ou assunto, filtre por status e prioridade.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="admin-tickets-list"]',
    title: "Lista de Tickets",
    content: "Veja todos os tickets, altere status rapidamente ou clique para ver detalhes completos.",
    placement: "top",
  },
];

const AdminTickets = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [prioridadeFilter, setPrioridadeFilter] = useState("all");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  const { restartTutorial } = useTutorial("admin-tickets", adminTicketsTutorialSteps);
  
  const { data: isSuperAdmin, isLoading: isCheckingAdmin } = useIsSuperAdmin();
  const { data: tickets, isLoading } = useAllTickets();
  const { data: stats } = useTicketStats();
  const updateStatus = useUpdateTicketStatus();

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

  // Redirect if not super admin
  if (!isCheckingAdmin && !isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setDetailsDialogOpen(true);
  };

  const handleStatusChange = async (ticketId: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateStatus.mutateAsync({ ticketId, status: newStatus });
      toast({
        title: "Status atualizado",
        description: "O status do ticket foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  };

  const filteredTickets = tickets?.filter((ticket) => {
    const matchesSearch = searchTerm === "" || 
      ticket.protocolo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.assunto.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    const matchesPrioridade = prioridadeFilter === "all" || ticket.prioridade === prioridadeFilter;
    
    return matchesSearch && matchesStatus && matchesPrioridade;
  });

  const categoriaLabels: Record<string, string> = {
    bug: "Bug / Erro",
    duvida: "Dúvida",
    sugestao: "Sugestão",
    outro: "Outro",
  };

  if (isCheckingAdmin) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <TutorialOverlay page="admin-tickets" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div data-tutorial="admin-tickets-header" className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Administrar Tickets</h1>
            <p className="text-muted-foreground text-sm">
              Gerencie todos os tickets de suporte do sistema
            </p>
          </div>
          <TutorialButton onClick={restartTutorial} />
        </div>

        {/* Stats */}
        {stats && (
          <div data-tutorial="admin-tickets-stats" className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total</span>
                </div>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-muted-foreground">Abertos</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{stats.abertos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Em Análise</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">{stats.em_analise}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">Respondidos</span>
                </div>
                <p className="text-2xl font-bold text-green-600">{stats.respondidos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Resolvidos</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600">{stats.resolvidos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-muted-foreground">Fechados</span>
                </div>
                <p className="text-2xl font-bold text-gray-600">{stats.fechados}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div data-tutorial="admin-tickets-filters" className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por protocolo ou assunto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="respondido">Respondido</SelectItem>
              <SelectItem value="resolvido">Resolvido</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="urgente">Urgente</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTickets && filteredTickets.length > 0 ? (
          <div data-tutorial="admin-tickets-list" className="space-y-3">
            {filteredTickets.map((ticket) => (
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
                        <span className="font-medium">Aberto por:</span>{" "}
                        {ticket.profiles?.name || "Usuário desconhecido"}
                        {ticket.profiles?.email && ` (${ticket.profiles.email})`}
                        <span className="mx-1">•</span>
                        {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex gap-2">
                        <TicketStatusBadge status={ticket.status} />
                        <TicketPriorityBadge prioridade={ticket.prioridade} />
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {ticket.status === 'aberto' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={(e) => handleStatusChange(ticket.id, 'em_analise', e)}
                          >
                            Analisar
                          </Button>
                        )}
                        {ticket.status === 'em_analise' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-blue-600"
                            onClick={(e) => handleStatusChange(ticket.id, 'respondido', e)}
                          >
                            Marcar Respondido
                          </Button>
                        )}
                        {ticket.status === 'respondido' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-emerald-600"
                            onClick={(e) => handleStatusChange(ticket.id, 'resolvido', e)}
                          >
                            Resolver
                          </Button>
                        )}
                        {ticket.status !== 'fechado' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={(e) => handleStatusChange(ticket.id, 'fechado', e)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Encerrar
                          </Button>
                        )}
                      </div>
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
              <h3 className="font-medium text-lg mb-1">Nenhum ticket encontrado</h3>
              <p className="text-muted-foreground text-sm text-center">
                {searchTerm || statusFilter !== "all" || prioridadeFilter !== "all"
                  ? "Nenhum ticket corresponde aos filtros aplicados."
                  : "Não há tickets de suporte no sistema."}
              </p>
            </CardContent>
          </Card>
        )}

        <TicketDetailsDialog
          ticketId={selectedTicketId}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          isAdmin={true}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminTickets;
