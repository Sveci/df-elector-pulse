import React, { useState, useMemo } from "react";
import { useTenantContext } from "@/contexts/TenantContext";
import { useProposicoesRealtime } from "@/hooks/proposicoes/useProposicoesRealtime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  MoreVertical,
  Trash2,
  Eye,
  RefreshCw,
  Bell,
  BellOff,
  Settings2,
  Pencil,
  Search,
  Loader2,
  FileText,
  Smartphone,
  Users,
  Zap,
  Cloud,
  X,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { ProposicaoDrawer } from "@/components/proposicoes/ProposicaoDrawer";
import { AdicionarProposicaoModal } from "@/components/proposicoes/AdicionarProposicaoModal";
import { AlertasConfigModal } from "@/components/proposicoes/AlertasConfigModal";
import { TramitacoesTimeline } from "@/components/proposicoes/TramitacoesTimeline";

import {
  useProposicoesMonitoradas,
  useRemoveProposicao,
  getGrupoSituacao,
  getSituacaoColor,
  getSituacaoLabel,
  ProposicaoMonitorada,
  GrupoSituacao,
} from "@/hooks/proposicoes/useProposicoesMonitoradas";
import {
  useAlertasConfig,
  useDeleteAlerta,
  useToggleAlerta,
  AlertaConfig,
} from "@/hooks/proposicoes/useAlertasConfig";
import { useTramitacoesCached } from "@/hooks/proposicoes/useProposicaoDetalhe";
import { useRunMonitor } from "@/hooks/proposicoes/useAlertasConfig";
import { cn } from "@/lib/utils";

// ─── Subcomponent: Painel de tramitações recentes (tab Histórico) ─────────────
function HistoricoTab() {
  const { data: proposicoes } = useProposicoesMonitoradas();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => proposicoes?.[0]?.id ?? null
  );
  const [search, setSearch] = useState("");

  const { data: tramitacoes, isLoading } = useTramitacoesCached(selectedId);

  const filtered = proposicoes?.filter((p) =>
    `${p.sigla_tipo} ${p.numero}/${p.ano} ${p.ementa || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-4 h-[calc(100vh-240px)] min-h-[400px]">
      {/* Left: proposição selector */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar..."
            className="pl-8 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ScrollArea className="flex-1 border rounded-lg">
          {!filtered || filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              Nenhuma proposição
            </div>
          ) : (
            <ul className="p-1 space-y-0.5">
              {filtered.map((p) => {
                const grupo = getGrupoSituacao(p.cod_situacao);
                return (
                  <li key={p.id}>
                    <button
                      className={cn(
                        "w-full text-left rounded-md px-2.5 py-2 text-sm transition-colors",
                        selectedId === p.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="font-medium truncate">
                        {p.sigla_tipo} {p.numero}/{p.ano}
                      </div>
                      <div className={cn(
                        "text-xs truncate mt-0.5",
                        selectedId === p.id ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}>
                        {getSituacaoLabel(grupo)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </div>

      {/* Right: timeline */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        <ScrollArea className="h-full px-4 py-4">
          {!selectedId ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground text-sm">
              <FileText className="h-8 w-8 opacity-40" />
              <p>Selecione uma proposição para ver o histórico</p>
            </div>
          ) : (
            <TramitacoesTimeline
              tramitacoes={tramitacoes || []}
              isLoading={isLoading}
            />
          )}
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── Subcomponent: Tab de alertas ─────────────────────────────────────────────
function AlertasTab() {
  const { data: alertas, isLoading } = useAlertasConfig();
  const deleteAlerta = useDeleteAlerta();
  const toggleAlerta = useToggleAlerta();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AlertaConfig | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleEdit(alerta: AlertaConfig) {
    setEditing(alerta);
    setModalOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure quem receberá notificações WhatsApp sobre tramitações.
          </p>
        </div>
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo alerta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando alertas...
        </div>
      ) : !alertas || alertas.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 border rounded-lg text-muted-foreground">
          <Bell className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum alerta configurado</p>
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" />
            Criar primeiro alerta
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {alertas.map((alerta) => (
            <Card key={alerta.id} className={cn("transition-opacity", !alerta.ativo && "opacity-60")}>
              <CardContent className="flex items-center gap-4 py-3 px-4">
                {/* Provider icon */}
                <div className="shrink-0">
                  {alerta.provider === "zapi" ? (
                    <Zap className="h-5 w-5 text-green-600" />
                  ) : (
                    <Cloud className="h-5 w-5 text-blue-600" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{alerta.nome}</span>
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {alerta.provider === "zapi" ? "Z-API" : "Meta Cloud"}
                    </Badge>
                    {alerta.tipo_destino === "grupo_zapi" ? (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                        <Users className="h-3 w-3" />
                        Grupo
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0 gap-1">
                        <Smartphone className="h-3 w-3" />
                        Individual
                      </Badge>
                    )}
                    {alerta.eventos_criticos_only ? (
                      <Badge className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">
                        Só críticos
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        Todos os eventos
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {alerta.destino_nome || alerta.destino}
                  </p>
                </div>

                {/* Toggle ativo */}
                <div className="flex items-center gap-1 shrink-0">
                  {alerta.ativo ? (
                    <Bell className="h-4 w-4 text-green-600" />
                  ) : (
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Switch
                    checked={alerta.ativo}
                    onCheckedChange={(v) => toggleAlerta.mutate({ id: alerta.id, ativo: v })}
                  />
                </div>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(alerta)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setDeletingId(alerta.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertasConfigModal
        open={modalOpen}
        onOpenChange={(v) => {
          setModalOpen(v);
          if (!v) setEditing(null);
        }}
        editingAlerta={editing}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir alerta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O alerta será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deletingId && deleteAlerta.mutate(deletingId); setDeletingId(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Proposicoes() {
  const { activeTenant } = useTenantContext();
  useProposicoesRealtime(activeTenant?.id);
  const queryClient = useQueryClient();

  const { data: proposicoes, isLoading, refetch } = useProposicoesMonitoradas();
  const removeProposicao = useRemoveProposicao();
  const runMonitor = useRunMonitor();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProposicao, setSelectedProposicao] = useState<ProposicaoMonitorada | null>(null);
  const [adicionarOpen, setAdicionarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ── Filter states ──
  const [selectedSituacoes, setSelectedSituacoes] = useState<string[]>(["tramitando"]);
  const [selectedOrgao, setSelectedOrgao] = useState<string>("todos");
  const [selectedPeriodo, setSelectedPeriodo] = useState<string>("qualquer");

  // ── Sync mutation ──
  const syncProposicoes = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("auto-discover-proposicoes", {});
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["proposicoes-monitoradas"] });
      toast.success(`Sincronização: ${data?.new_proposicoes || 0} novas proposições encontradas`);
    },
    onError: (err: any) => {
      toast.error("Erro na sincronização: " + err.message);
    },
  });

  function handleOpenDrawer(p: ProposicaoMonitorada) {
    setSelectedProposicao(p);
    setDrawerOpen(true);
  }

  // ── Unique organs for filter ──
  const uniqueOrgaos = useMemo(() => {
    if (!proposicoes) return [];
    const set = new Set<string>();
    proposicoes.forEach((p) => {
      if (p.sigla_orgao_situacao) set.add(p.sigla_orgao_situacao);
    });
    return Array.from(set).sort();
  }, [proposicoes]);

  // ── Stats (always from full data, unfiltered) ──
  const stats = {
    total: proposicoes?.length ?? 0,
    tramitando: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "tramitando").length ?? 0,
    atencao: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "atencao").length ?? 0,
    aprovadas: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "aprovada").length ?? 0,
    arquivadas: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "arquivada").length ?? 0,
  };

  // ── Combined filtering ──
  const filtered = proposicoes?.filter((p) => {
    // Text search
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      `${p.sigla_tipo} ${p.numero}/${p.ano}`.toLowerCase().includes(q) ||
      (p.ementa || "").toLowerCase().includes(q) ||
      (p.autor_nome || "").toLowerCase().includes(q);

    // Situation filter
    const grupo = getGrupoSituacao(p.cod_situacao);
    const matchesSituacao =
      selectedSituacoes.length === 0 ||
      selectedSituacoes.includes("todas") ||
      selectedSituacoes.includes(grupo);

    // Organ filter
    const matchesOrgao =
      !selectedOrgao ||
      selectedOrgao === "todos" ||
      p.sigla_orgao_situacao === selectedOrgao;

    // Date filter
    const matchesData =
      !selectedPeriodo ||
      selectedPeriodo === "qualquer" ||
      (() => {
        if (!p.ultima_data_tramitacao) return false;
        const d = new Date(p.ultima_data_tramitacao);
        const now = new Date();
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        switch (selectedPeriodo) {
          case "semana": return diffDays <= 7;
          case "mes": return diffDays <= 30;
          case "trimestre": return diffDays <= 90;
          case "ano": return diffDays <= 365;
          default: return true;
        }
      })();

    return matchesSearch && matchesSituacao && matchesOrgao && matchesData;
  });

  const hasActiveFilters =
    selectedSituacoes.length > 0 && !selectedSituacoes.includes("todas") ||
    selectedOrgao !== "todos" ||
    selectedPeriodo !== "qualquer" ||
    searchTerm.length > 0;

  function handleClearFilters() {
    setSelectedSituacoes(["tramitando"]);
    setSelectedOrgao("todos");
    setSelectedPeriodo("qualquer");
    setSearchTerm("");
  }

  function handleSituacaoChange(value: string[]) {
    if (value.includes("todas")) {
      // If "todas" was just selected, set only "todas"
      if (!selectedSituacoes.includes("todas")) {
        setSelectedSituacoes(["todas"]);
      } else {
        // "todas" was already selected and user clicked something else
        setSelectedSituacoes(value.filter((v) => v !== "todas"));
      }
    } else if (value.length === 0) {
      // Nothing selected = show all
      setSelectedSituacoes(["todas"]);
    } else {
      setSelectedSituacoes(value);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold">Proposições Legislativas</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoramento em tempo real de PLs, PECs e demais proposições
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 cursor-default">
                  <Activity className="h-3 w-3" />
                  Auto-monitoramento ativo
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                O sistema busca automaticamente novas proposições do parlamentar vinculado a cada 6 horas
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncProposicoes.mutate()}
            disabled={syncProposicoes.isPending}
            className="gap-1.5"
          >
            {syncProposicoes.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar agora
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runMonitor.mutate()}
            disabled={runMonitor.isPending}
            className="gap-1.5"
          >
            {runMonitor.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Verificar agora
          </Button>
          <Button size="sm" onClick={() => setAdicionarOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Buscar manualmente
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-blue-200">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-blue-600 font-medium">Tramitando</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-blue-700">{stats.tramitando}</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-yellow-600 font-medium">Atenção</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-yellow-700">{stats.atencao}</p>
            </CardContent>
          </Card>
          <Card className="border-green-200">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-green-600 font-medium">Aprovadas</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-green-700">{stats.aprovadas}</p>
            </CardContent>
          </Card>
          <Card className="border-red-200">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-red-600 font-medium">Arquivadas</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-red-700">{stats.arquivadas}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="proposicoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="proposicoes" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Proposições monitoradas
            {stats.total > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                {stats.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico de tramitações</TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5">
            <Bell className="h-4 w-4" />
            Alertas WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Proposições monitoradas ── */}
        <TabsContent value="proposicoes" className="space-y-3">
          {/* Filters bar */}
          {(proposicoes?.length ?? 0) > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                {/* Situation toggle group */}
                <ToggleGroup
                  type="multiple"
                  value={selectedSituacoes}
                  onValueChange={handleSituacaoChange}
                  className="flex-wrap"
                >
                  <ToggleGroupItem
                    value="todas"
                    className="text-xs h-8 px-3 data-[state=on]:bg-muted data-[state=on]:text-foreground"
                  >
                    Todas ({stats.total})
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="tramitando"
                    className="text-xs h-8 px-3 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-800 data-[state=on]:border-blue-200"
                  >
                    Tramitando ({stats.tramitando})
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="atencao"
                    className="text-xs h-8 px-3 data-[state=on]:bg-yellow-100 data-[state=on]:text-yellow-800 data-[state=on]:border-yellow-200"
                  >
                    Atenção ({stats.atencao})
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="aprovada"
                    className="text-xs h-8 px-3 data-[state=on]:bg-green-100 data-[state=on]:text-green-800 data-[state=on]:border-green-200"
                  >
                    Aprovadas ({stats.aprovadas})
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="arquivada"
                    className="text-xs h-8 px-3 data-[state=on]:bg-red-100 data-[state=on]:text-red-800 data-[state=on]:border-red-200"
                  >
                    Arquivadas ({stats.arquivadas})
                  </ToggleGroupItem>
                </ToggleGroup>

                {/* Organ select */}
                <Select value={selectedOrgao} onValueChange={setSelectedOrgao}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Filtrar por órgão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os órgãos</SelectItem>
                    {uniqueOrgaos.map((orgao) => (
                      <SelectItem key={orgao} value={orgao}>
                        {orgao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Date select */}
                <Select value={selectedPeriodo} onValueChange={setSelectedPeriodo}>
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Filtrar por data" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qualquer">Qualquer data</SelectItem>
                    <SelectItem value="semana">Última semana</SelectItem>
                    <SelectItem value="mes">Último mês</SelectItem>
                    <SelectItem value="trimestre">Últimos 3 meses</SelectItem>
                    <SelectItem value="ano">Último ano</SelectItem>
                  </SelectContent>
                </Select>

                {/* Clear filters */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFilters}
                    className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Search + results count */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por tipo, número, ementa ou autor..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                {hasActiveFilters && filtered && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Mostrando {filtered.length} de {stats.total} proposições
                  </span>
                )}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 py-12 justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando proposições...
            </div>
          ) : !filtered || filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 border rounded-lg text-muted-foreground">
              <FileText className="h-12 w-12 opacity-30" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {(proposicoes?.length ?? 0) > 0
                    ? "Nenhuma proposição encontrada com os filtros atuais"
                    : "Nenhuma proposição monitorada"}
                </p>
                <p className="text-xs mt-1">
                  {(proposicoes?.length ?? 0) > 0
                    ? "Tente ajustar os filtros ou limpar a busca"
                    : "Adicione PLs, PECs e outras proposições para monitorar em tempo real"}
                </p>
              </div>
              {(proposicoes?.length ?? 0) > 0 ? (
                <Button variant="outline" onClick={handleClearFilters} className="gap-1.5">
                  <X className="h-4 w-4" />
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => setAdicionarOpen(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Adicionar primeira proposição
                </Button>
              )}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[130px]">Proposição</TableHead>
                    <TableHead>Ementa</TableHead>
                    <TableHead className="hidden sm:table-cell w-[120px]">Situação</TableHead>
                    <TableHead className="hidden md:table-cell w-[100px]">Órgão</TableHead>
                    <TableHead className="hidden lg:table-cell w-[120px]">Atualização</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const grupo = getGrupoSituacao(p.cod_situacao);
                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => handleOpenDrawer(p)}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-sm font-semibold">
                              {p.sigla_tipo} {p.numero}/{p.ano}
                            </span>
                            <Badge
                              className={cn("text-xs px-1.5 py-0 w-fit sm:hidden", getSituacaoColor(grupo))}
                            >
                              {getSituacaoLabel(grupo)}
                            </Badge>
                            {p.autor_nome && (
                              <span className="text-xs text-muted-foreground truncate max-w-[110px]">
                                {p.autor_nome}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm line-clamp-2 leading-relaxed">
                            {p.ementa || "—"}
                          </p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge className={cn("text-xs", getSituacaoColor(grupo))}>
                            {getSituacaoLabel(grupo)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {p.sigla_orgao_situacao || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {p.ultima_data_tramitacao
                            ? format(new Date(p.ultima_data_tramitacao), "dd/MM/yyyy", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenDrawer(p)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => removeProposicao.mutate(p.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remover monitoramento
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: Histórico ── */}
        <TabsContent value="historico">
          {!proposicoes || proposicoes.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground text-sm">
              <FileText className="h-10 w-10 opacity-30" />
              <p>Adicione proposições primeiro para ver o histórico</p>
            </div>
          ) : (
            <HistoricoTab />
          )}
        </TabsContent>

        {/* ── Tab 3: Alertas ── */}
        <TabsContent value="alertas">
          <AlertasTab />
        </TabsContent>
      </Tabs>

      {/* Modais / Drawers */}
      <AdicionarProposicaoModal
        open={adicionarOpen}
        onOpenChange={setAdicionarOpen}
      />
      <ProposicaoDrawer
        proposicao={selectedProposicao}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
