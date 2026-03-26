import React, { useState } from "react";
import { useTenantContext } from "@/contexts/TenantContext";
import { useProposicoesRealtime } from "@/hooks/proposicoes/useProposicoesRealtime";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
                      onClick={() => deleteAlerta.mutate(alerta.id)}
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
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Proposicoes() {
  const { activeTenant } = useTenantContext();
  useProposicoesRealtime(activeTenant?.id);

  const { data: proposicoes, isLoading, refetch } = useProposicoesMonitoradas();
  const removeProposicao = useRemoveProposicao();
  const runMonitor = useRunMonitor();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProposicao, setSelectedProposicao] = useState<ProposicaoMonitorada | null>(null);
  const [adicionarOpen, setAdicionarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  function handleOpenDrawer(p: ProposicaoMonitorada) {
    setSelectedProposicao(p);
    setDrawerOpen(true);
  }

  const filtered = proposicoes?.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      !q ||
      `${p.sigla_tipo} ${p.numero}/${p.ano}`.toLowerCase().includes(q) ||
      (p.ementa || "").toLowerCase().includes(q) ||
      (p.autor_nome || "").toLowerCase().includes(q)
    );
  });

  const stats = {
    total: proposicoes?.length ?? 0,
    tramitando: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "tramitando").length ?? 0,
    atencao: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "atencao").length ?? 0,
    aprovadas: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "aprovada").length ?? 0,
    arquivadas: proposicoes?.filter((p) => getGrupoSituacao(p.cod_situacao) === "arquivada").length ?? 0,
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Proposições Legislativas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento em tempo real de PLs, PECs e demais proposições
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            Adicionar proposição
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
          {/* Search */}
          {(proposicoes?.length ?? 0) > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por tipo, número, ementa ou autor..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
                <p className="text-sm font-medium">Nenhuma proposição monitorada</p>
                <p className="text-xs mt-1">
                  Adicione PLs, PECs e outras proposições para monitorar em tempo real
                </p>
              </div>
              <Button onClick={() => setAdicionarOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Adicionar primeira proposição
              </Button>
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
