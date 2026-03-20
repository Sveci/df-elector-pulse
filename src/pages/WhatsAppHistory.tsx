import { useState } from "react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Search, Filter, Clock, CheckCircle2, XCircle, AlertCircle, Send, Inbox, ArrowUpDown, RefreshCw, CheckCheck, BookOpen, AlertTriangle, Eye } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useWhatsAppMessages, WhatsAppFilters, WhatsAppMessage, useWhatsAppMetrics } from "@/hooks/useWhatsAppMessages";
import { MessageStatusBadge } from "@/components/whatsapp/MessageStatusBadge";
import { MessageDetailsDialog } from "@/components/whatsapp/MessageDetailsDialog";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const whatsappHistoryTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="whatsapp-history-header"]',
    title: "Histórico de WhatsApp",
    content: "Acompanhe todas as mensagens enviadas e recebidas via WhatsApp.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="whatsapp-history-metrics"]',
    title: "Métricas",
    content: "Visualize estatísticas de entrega, leitura e erros das mensagens.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="whatsapp-history-filters"]',
    title: "Filtros",
    content: "Filtre mensagens por direção (enviadas/recebidas), status e período.",
    placement: "bottom",
  },
];

const DirectionBadge = ({ direction }: { direction: string }) => (
  <Badge variant={direction === "outbound" ? "default" : "secondary"}>
    {direction === "outbound" ? <Send className="h-3 w-3 mr-1" /> : <Inbox className="h-3 w-3 mr-1" />}
    {direction === "outbound" ? "Enviada" : "Recebida"}
  </Badge>
);

export default function WhatsAppHistory() {
  const { m } = useDemoMask();
  const [filters, setFilters] = useState<WhatsAppFilters>({
    search: "",
    direction: "all",
    status: "all",
    period: "7days",
  });
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: messages, isLoading: messagesLoading, refetch } = useWhatsAppMessages(filters);
  const { data: metrics, isLoading: metricsLoading } = useWhatsAppMetrics();

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12) {
      return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phone;
  };

  const truncateMessage = (message: string, maxLength = 50) => {
    if (message.length <= maxLength) return message;
    return message.slice(0, maxLength) + "...";
  };

  const handleViewDetails = (message: WhatsAppMessage) => {
    setSelectedMessage(message);
    setDetailsOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <PageHeader icon={MessageSquare} title="Histórico de Mensagens WhatsApp" subtitle="Acompanhe todas as mensagens enviadas e recebidas" />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Send className="h-4 w-4" />
                Total Enviadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{m.number(metrics?.total || 0, "wa_total")}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-green-600" />
                Taxa de Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-green-600">
                  {m.percentage(metrics?.deliveryRate || 0, "wa_delivery").toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                Taxa de Leitura
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">
                  {m.percentage(metrics?.readRate || 0, "wa_read").toFixed(1)}%
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Com Erro
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-red-500">{m.number(metrics?.failed || 0, "wa_failed")}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por telefone, contato ou mensagem..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <Select
                value={filters.direction}
                onValueChange={(value) =>
                  setFilters({ ...filters, direction: value as WhatsAppFilters["direction"] })
                }
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Direção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="outgoing">Enviadas</SelectItem>
                  <SelectItem value="incoming">Recebidas</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.status}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value as WhatsAppFilters["status"] })
                }
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="sent">Enviada</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="read">Lida</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.period}
                onValueChange={(value) =>
                  setFilters({ ...filters, period: value as WhatsAppFilters["period"] })
                }
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="7days">Últimos 7 dias</SelectItem>
                  <SelectItem value="30days">Últimos 30 dias</SelectItem>
                  <SelectItem value="all">Todo período</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Messages Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Mensagens
              {messages && (
                <Badge variant="secondary" className="ml-2">
                  {messages.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {messagesLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead className="hidden md:table-cell">Mensagem</TableHead>
                      <TableHead>Contexto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden sm:table-cell">Data/Hora</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {messages.map((message) => (
                      <TableRow key={message.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <DirectionBadge direction={message.direction} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">
                              {m.phone(message.phone)}
                            </span>
                            {message.contact && (
                              <span className="text-xs text-muted-foreground">
                                {m.name(message.contact.nome)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[300px]">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground truncate block">
                                {truncateMessage(message.message)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[400px]">
                              <p className="whitespace-pre-wrap">{message.message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {message.visit ? (
                            <Badge variant="outline" className="text-xs">
                              🏛️ {message.visit.protocolo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <MessageStatusBadge
                            status={message.status}
                            direction={message.direction}
                          />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {format(new Date(message.created_at), "dd/MM HH:mm", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetails(message)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Nenhuma mensagem encontrada
                </h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Ajuste os filtros ou aguarde o envio de novas mensagens
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Details Dialog */}
        <MessageDetailsDialog
          message={selectedMessage}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      </div>
    </div>
  );
}
