import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Clock, Calendar, Mail, MessageSquare, Phone, Trash2, CheckCircle, XCircle, Loader2, AlertCircle, Filter, Ban, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useScheduledMessages, useScheduledMessageStats, useCancelScheduledMessages } from "@/hooks/useScheduledMessages";
import { ScheduleMessageDialog } from "@/components/scheduling/ScheduleMessageDialog";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const scheduledTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="scheduled-header"]',
    title: "Mensagens Agendadas",
    content: "Gerencie envios programados de SMS, Email e WhatsApp. Visualize status e cancele mensagens pendentes.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="scheduled-stats"]',
    title: "Estatísticas",
    content: "Acompanhe quantas mensagens estão aguardando, processando, enviadas ou com falha.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="scheduled-filters"]',
    title: "Filtros",
    content: "Filtre mensagens por status (pendente, enviado, falhou) e tipo (SMS, Email, WhatsApp).",
    placement: "bottom",
  },
];

export default function ScheduledMessages() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { restartTutorial } = useTutorial("scheduled-messages", scheduledTutorialSteps);

  const { data: messages, isLoading } = useScheduledMessages({
    status: statusFilter === "all" ? undefined : statusFilter,
    messageType: typeFilter === "all" ? undefined : typeFilter,
  });

  const { data: stats } = useScheduledMessageStats();
  const cancelMutation = useCancelScheduledMessages();

  const filteredMessages = messages?.filter((msg) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      msg.recipient_name?.toLowerCase().includes(searchLower) ||
      msg.recipient_phone?.includes(search) ||
      msg.recipient_email?.toLowerCase().includes(searchLower) ||
      msg.template_slug.toLowerCase().includes(searchLower)
    );
  });

  const handleCancelSelected = () => {
    if (selectedIds.length === 0) return;
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    try {
      await cancelMutation.mutateAsync(selectedIds);
      toast.success(`${selectedIds.length} mensagem(ns) cancelada(s)`);
      setSelectedIds([]);
      setCancelDialogOpen(false);
    } catch {
      toast.error("Erro ao cancelar mensagens");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAllPending = () => {
    const pendingIds = filteredMessages?.filter((m) => m.status === "pending").map((m) => m.id) || [];
    setSelectedIds(pendingIds);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="border-amber-500/50 bg-amber-50 text-amber-700">
            <Clock className="mr-1 h-3 w-3" /> Aguardando
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="border-blue-500/50 bg-blue-50 text-blue-700">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Processando
          </Badge>
        );
      case "sent":
        return (
          <Badge variant="outline" className="border-green-500/50 bg-green-50 text-green-700">
            <CheckCircle className="mr-1 h-3 w-3" /> Enviado
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="border-red-500/50 bg-red-50 text-red-700">
            <AlertCircle className="mr-1 h-3 w-3" /> Falhou
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="border-gray-500/50 bg-gray-50 text-gray-700">
            <Ban className="mr-1 h-3 w-3" /> Cancelado
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <Phone className="h-4 w-4 text-green-600" />;
      case "email":
        return <Mail className="h-4 w-4 text-blue-600" />;
      case "whatsapp":
        return <MessageSquare className="h-4 w-4 text-emerald-600" />;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <TutorialOverlay page="scheduled-messages" />
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        <div data-tutorial="scheduled-header" className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Mensagens Agendadas</h1>
            <p className="text-muted-foreground">
              Gerencie envios programados de SMS, E-mail e WhatsApp
            </p>
          </div>
          <TutorialButton onClick={restartTutorial} />
        </div>

        {/* Stats Cards */}
        <div data-tutorial="scheduled-stats" className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground">Aguardando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats?.processing || 0}</p>
                  <p className="text-xs text-muted-foreground">Processando</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ban className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-2xl font-bold">{stats?.cancelled || 0}</p>
                  <p className="text-xs text-muted-foreground">Cancelados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card data-tutorial="scheduled-filters">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <CardTitle className="text-lg">Fila de Mensagens</CardTitle>
              <div className="flex flex-wrap gap-2">
                {selectedIds.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleCancelSelected}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Cancelar ({selectedIds.length})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={selectAllPending}>
                  Selecionar Pendentes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone, email ou template..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Aguardando</SelectItem>
                  <SelectItem value="processing">Processando</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredMessages?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma mensagem agendada</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-10">Tipo</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Agendado para</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages?.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          {msg.status === "pending" && (
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(msg.id)}
                              onChange={() => toggleSelect(msg.id)}
                              className="rounded border-gray-300"
                            />
                          )}
                        </TableCell>
                        <TableCell>{getTypeIcon(msg.message_type)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{msg.recipient_name || "-"}</p>
                            <p className="text-sm text-muted-foreground">
                              {msg.recipient_phone || msg.recipient_email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {msg.template_slug}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(msg.scheduled_for), "dd/MM/yyyy", { locale: ptBR })}</p>
                            <p className="text-muted-foreground">
                              {format(new Date(msg.scheduled_for), "HH:mm")}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {getStatusBadge(msg.status)}
                            {msg.error_message && (
                              <p className="text-xs text-red-600 max-w-[200px] truncate" title={msg.error_message}>
                                {msg.error_message}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Mensagens</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar {selectedIds.length} mensagem(ns) agendada(s)?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel} className="bg-destructive text-destructive-foreground">
              Cancelar Mensagens
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
