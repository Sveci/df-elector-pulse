import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect } from "react";
import { GitBranch, Crown, Plus, Users, Award, Target, Loader2, Search, Star } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useCoordinators,
  useLeaderTree,
  useDemoteCoordinator,
  useSearchLeaders,
  LeaderSearchResult
} from "@/hooks/leaders/useLeaderTree";
import { useLeaderHierarchyPath } from "@/hooks/leaders/useLeaderHierarchyPath";
import { CoordinatorCard } from "@/components/leaders/CoordinatorCard";
import { LeaderTreeView } from "@/components/leaders/LeaderTreeView";
import { PromoteToCoordinatorDialog } from "@/components/leaders/PromoteToCoordinatorDialog";
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
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const leaderTreeTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="tree-header"]',
    title: '🌳 Árvore de Lideranças',
    content: 'Visualize e gerencie a hierarquia multinível de coordenadores e líderes do seu projeto político.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="tree-new-coord"]',
    title: '👑 Novo Coordenador',
    content: 'Promova um líder existente para coordenador. Coordenadores podem ter líderes subordinados em até 3 níveis.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="tree-stats"]',
    title: '📊 Estatísticas da Hierarquia',
    content: 'Veja o total de coordenadores, cadastros gerados pela rede e pontuação acumulada.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="tree-coordinators"]',
    title: '👥 Lista de Coordenadores',
    content: 'Selecione um coordenador para visualizar sua árvore de subordinados. Use a busca para encontrar líderes específicos.',
    placement: 'right',
  },
  {
    target: '[data-tutorial="tree-view"]',
    title: '🔍 Visualização da Árvore',
    content: 'Veja a estrutura hierárquica do coordenador selecionado com todos os níveis de líderes subordinados.',
    placement: 'left',
  },
];

export default function LeaderTree() {
  const { m } = useDemoMask();
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState<string | null>(null);
  const [showPromoteDialog, setShowPromoteDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [demoteConfirm, setDemoteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [highlightLeaderId, setHighlightLeaderId] = useState<string | null>(null);
  const [pendingLeaderSelection, setPendingLeaderSelection] = useState<LeaderSearchResult | null>(null);

  const { data: coordinators, isLoading: loadingCoordinators } = useCoordinators();
  const { data: searchResults, isLoading: loadingSearch } = useSearchLeaders(searchTerm);
  const { data: tree, isLoading: loadingTree } = useLeaderTree(selectedCoordinatorId);
  const demoteCoordinator = useDemoteCoordinator();
  const { data: hierarchyPath } = useLeaderHierarchyPath(pendingLeaderSelection?.id);

  const selectedCoordinator = coordinators?.find(c => c.id === selectedCoordinatorId);

  // When hierarchy path loads, find coordinator and select
  useEffect(() => {
    if (hierarchyPath && hierarchyPath.length > 0 && pendingLeaderSelection) {
      const coordinator = hierarchyPath.find(node => node.is_coordinator);
      if (coordinator) {
        setSelectedCoordinatorId(coordinator.id);
        setHighlightLeaderId(pendingLeaderSelection.id);
      }
      setPendingLeaderSelection(null);
    }
  }, [hierarchyPath, pendingLeaderSelection]);

  // Normalize string: remove accents and convert to lowercase
  const normalizeString = (str: string): string => {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  };

  // Use server-side search results directly
  const filteredLeaders = searchResults || [];

  // Separate coordinators and non-coordinators from search results
  const searchedCoordinators = filteredLeaders.filter(l => l.is_coordinator);
  const searchedLeaders = filteredLeaders.filter(l => !l.is_coordinator && l.hierarchy_level);

  // Original coordinator filter (when not searching)
  const filteredCoordinators = coordinators?.filter((coordinator) => {
    if (!searchTerm.trim()) return true;

    const search = normalizeString(searchTerm.trim());
    const searchDigits = searchTerm.replace(/\D/g, "");

    const matchesName = normalizeString(coordinator.nome_completo || "").includes(search);
    const matchesEmail = (coordinator.email || "").toLowerCase().includes(search);
    const matchesPhone = searchDigits.length >= 4 &&
      coordinator.telefone?.replace(/\D/g, "").includes(searchDigits);

    return matchesName || matchesEmail || matchesPhone;
  });

  const handleSelectLeader = (leader: LeaderSearchResult) => {
    if (leader.is_coordinator) {
      setSelectedCoordinatorId(leader.id);
      setHighlightLeaderId(null);
      setSearchTerm("");
    } else {
      setPendingLeaderSelection(leader);
      setSearchTerm("");
    }
  };

  const handleDemote = async () => {
    if (!demoteConfirm) return;
    await demoteCoordinator.mutateAsync(demoteConfirm.id);
    if (selectedCoordinatorId === demoteConfirm.id) {
      setSelectedCoordinatorId(null);
    }
    setDemoteConfirm(null);
  };

  const getLevelLabel = (level: number | null) => {
    switch (level) {
      case 2: return "Nível 1";
      case 3: return "Nível 2";
      case 4: return "Nível 3";
      default: return "Líder";
    }
  };

  const { restartTutorial } = useTutorial("leader-tree", leaderTreeTutorialSteps);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <TutorialOverlay page="leader-tree" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" data-tutorial="tree-header">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              Árvore de Lideranças
            </h1>
            <TutorialButton onClick={restartTutorial} />
          </div>
          <p className="text-muted-foreground mt-1">
            Gerencie a hierarquia multinível de coordenadores e líderes
          </p>
        </div>
        <Button onClick={() => setShowPromoteDialog(true)} className="gap-2" data-tutorial="tree-new-coord">
          <Crown className="h-4 w-4" />
          Novo Coordenador
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-tutorial="tree-stats">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Crown className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{m.number(coordinators?.length || 0, "tree_coords")}</p>
              <p className="text-sm text-muted-foreground">Coordenadores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {m.number(coordinators?.reduce((sum, c) => sum + c.total_cadastros, 0) || 0, "tree_cadastros")}
              </p>
              <p className="text-sm text-muted-foreground">Cadastros Totais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <Award className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {m.number(coordinators?.reduce((sum, c) => sum + c.total_pontos, 0) || 0, "tree_pontos")}
              </p>
              <p className="text-sm text-muted-foreground">Pontos Totais</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Coordinators List */}
        <Card className="lg:col-span-2" data-tutorial="tree-coordinators">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Coordenadores
            </CardTitle>
            <CardDescription>
              Selecione um coordenador para ver sua árvore
            </CardDescription>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingCoordinators ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : searchTerm.trim() && loadingSearch ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" />
                  <p className="text-sm">Buscando líderes...</p>
                </div>
              ) : searchTerm.trim() && (searchedCoordinators.length > 0 || searchedLeaders.length > 0) ? (
                <div className="p-4 space-y-4">
                  {/* Coordenadores encontrados */}
                  {searchedCoordinators.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Crown className="h-3 w-3" /> Coordenadores encontrados
                      </p>
                      {searchedCoordinators.map((leader) => {
                        const coord = coordinators?.find(c => c.id === leader.id);
                        if (coord) {
                          return (
                            <CoordinatorCard
                              key={coord.id}
                              coordinator={coord}
                              isSelected={selectedCoordinatorId === coord.id}
                              onSelect={() => handleSelectLeader(leader)}
                              onDemote={() => setDemoteConfirm({ id: coord.id, name: coord.nome_completo })}
                            />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Líderes encontrados */}
                  {searchedLeaders.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Star className="h-3 w-3" /> Líderes encontrados
                      </p>
                      {searchedLeaders.map((leader) => (
                        <div
                          key={leader.id}
                          className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleSelectLeader(leader)}
                        >
                          <div className="flex items-center gap-2">
                            <Star className="h-4 w-4 text-blue-500" />
                            <span className="font-medium flex-1 truncate">{m.name(leader.nome_completo)}</span>
                            <Badge variant="outline" className="text-xs">
                              {getLevelLabel(leader.hierarchy_level)}
                            </Badge>
                          </div>
                          {leader.cidade_nome && (
                            <p className="text-xs text-muted-foreground mt-1 ml-6">{m.city(leader.cidade_nome)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : searchTerm.trim() && filteredLeaders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground p-4">
                  <Search className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm text-center">Nenhum líder encontrado</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setSearchTerm("")}
                  >
                    Limpar busca
                  </Button>
                </div>
              ) : coordinators?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground p-4">
                  <Crown className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm text-center">Nenhum coordenador cadastrado</p>
                  <Button
                    variant="link"
                    className="mt-2"
                    onClick={() => setShowPromoteDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Promover primeiro coordenador
                  </Button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {filteredCoordinators?.map((coordinator) => (
                    <CoordinatorCard
                      key={coordinator.id}
                      coordinator={coordinator}
                      isSelected={selectedCoordinatorId === coordinator.id}
                      onSelect={() => {
                        setSelectedCoordinatorId(coordinator.id);
                        setHighlightLeaderId(null);
                      }}
                      onDemote={() => setDemoteConfirm({ id: coordinator.id, name: coordinator.nome_completo })}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Tree View */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary" />
              {selectedCoordinator ? (
                <>Hierarquia de {m.name(selectedCoordinator.nome_completo)}</>
              ) : (
                <>Visualização da Árvore</>
              )}
            </CardTitle>
            {selectedCoordinator && (
              <CardDescription className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {selectedCoordinator.total_leaders} {selectedCoordinator.total_leaders === 1 ? 'indicação' : 'indicações'}
                </span>
                <span className="flex items-center gap-1">
                  <Award className="h-4 w-4" />
                  {selectedCoordinator.total_pontos} pontos
                </span>
              </CardDescription>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {!selectedCoordinatorId ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mb-4 opacity-30" />
                  <p>Selecione um coordenador para ver sua árvore</p>
                </div>
              ) : loadingTree ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tree ? (
                <LeaderTreeView tree={tree} highlightLeaderId={highlightLeaderId} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-30" />
                  <p>Nenhum subordinado nesta árvore</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Promote Dialog */}
      <PromoteToCoordinatorDialog
        open={showPromoteDialog}
        onOpenChange={setShowPromoteDialog}
      />

      {/* Demote Confirmation */}
      <AlertDialog open={!!demoteConfirm} onOpenChange={() => setDemoteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebaixar Coordenador</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja rebaixar <strong>{demoteConfirm?.name}</strong>?
              <span className="block mt-2 text-amber-600">
                Todos os líderes subordinados serão desvinculados da hierarquia.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDemote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Rebaixar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
