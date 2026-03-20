import { useState, useMemo } from "react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Search,
  Send,
  CheckCheck,
  BookOpen,
  AlertTriangle,
  Filter,
  Eye,
  RefreshCw,
  User,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWhatsAppMessages,
  useWhatsAppMetrics,
  WhatsAppFilters,
  WhatsAppMessage,
} from "@/hooks/useWhatsAppMessages";
import { MessageStatusBadge, DirectionBadge } from "@/components/whatsapp/MessageStatusBadge";
import { MessageDetailsDialog } from "@/components/whatsapp/MessageDetailsDialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GroupedMessages {
  phone: string;
  normalizedPhone: string;
  contactName: string | null;
  messages: WhatsAppMessage[];
  latestMessageAt: string;
}

export function WhatsAppHistoryTab() {
  const { m } = useDemoMask();
  const [filters, setFilters] = useState<WhatsAppFilters>({
    search: "",
    direction: "all",
    status: "all",
    period: "7days",
  });
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: messages, isLoading: messagesLoading, refetch } = useWhatsAppMessages(filters);
  const { data: metrics, isLoading: metricsLoading } = useWhatsAppMetrics();

  // Normalize phone number to last 8 digits for grouping (handles 9th digit inconsistency)
  const normalizePhoneForGrouping = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.slice(-8);
  };

  // Group messages by normalized phone number
  const groupedMessages = useMemo(() => {
    if (!messages) return [];

    const groups: Record<string, GroupedMessages> = {};

    messages.forEach((msg) => {
      const normalizedPhone = normalizePhoneForGrouping(msg.phone);

      if (!groups[normalizedPhone]) {
        groups[normalizedPhone] = {
          phone: msg.phone, // Keep original phone for display
          normalizedPhone: normalizedPhone,
          contactName: msg.contact?.nome || null,
          messages: [],
          latestMessageAt: msg.created_at,
        };
      }
      groups[normalizedPhone].messages.push(msg);

      // Update contact name if we find one (prefer non-null)
      if (!groups[normalizedPhone].contactName && msg.contact?.nome) {
        groups[normalizedPhone].contactName = msg.contact.nome;
      }

      // Update latest message time if this message is newer
      if (new Date(msg.created_at) > new Date(groups[normalizedPhone].latestMessageAt)) {
        groups[normalizedPhone].latestMessageAt = msg.created_at;
        // Also update the display phone to the most recent one
        groups[normalizedPhone].phone = msg.phone;
      }
    });

    // Sort groups by latest message (most recent first), then messages within each group by created_at descending
    return Object.values(groups)
      .sort((a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime())
      .map(group => ({
        ...group,
        messages: group.messages.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
      }));
  }, [messages]);

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

  const toggleGroup = (phone: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phone)) {
        newSet.delete(phone);
      } else {
        newSet.add(phone);
      }
      return newSet;
    });
  };

  const expandAllGroups = () => {
    setExpandedGroups(new Set(groupedMessages.map(g => g.normalizedPhone)));
  };

  const collapseAllGroups = () => {
    setExpandedGroups(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Com Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{m.number(metrics?.failed || 0, "wa_failed")}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
          </div>
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

      {/* Messages Grouped by Recipient */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Conversas
              {groupedMessages.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {groupedMessages.length} destinatários • {messages?.length || 0} mensagens
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAllGroups}>
                Expandir todos
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAllGroups}>
                Recolher todos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {messagesLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : groupedMessages.length > 0 ? (
            <div className="divide-y">
              {groupedMessages.map((group) => (
                <Collapsible
                  key={group.normalizedPhone}
                  open={expandedGroups.has(group.normalizedPhone)}
                  onOpenChange={() => toggleGroup(group.normalizedPhone)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        {expandedGroups.has(group.normalizedPhone) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <div className="flex flex-col">
                          {group.contactName ? (
                            <>
                              <span className="font-medium">{m.name(group.contactName)}</span>
                              <span className="text-sm text-muted-foreground">{m.phone(group.phone)}</span>
                            </>
                          ) : (
                            <span className="font-medium">{m.phone(group.phone)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="secondary">{group.messages.length} msg</Badge>
                        <span className="text-xs text-muted-foreground">
                          Última: {format(new Date(group.latestMessageAt), "dd/MM HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto border-t bg-muted/20">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="hidden md:table-cell">Mensagem</TableHead>
                            <TableHead>Contexto</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data/Hora</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.messages.map((message) => (
                            <TableRow key={message.id} className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                <DirectionBadge direction={message.direction} />
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
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(message.created_at), "dd/MM HH:mm:ss", {
                                  locale: ptBR,
                                })}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetails(message);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
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
  );
}
