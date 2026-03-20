import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  ClipboardList,
  Users,
  BarChart3,
  Edit,
  Trash2,
  ExternalLink,
  Link2,
  Eye
} from "lucide-react";
import { useSurveys, useDeleteSurvey, type Survey } from "@/hooks/surveys/useSurveys";
import { CreateSurveyDialog } from "@/components/surveys/CreateSurveyDialog";
import { SurveyLeaderLinksDialog } from "@/components/surveys/SurveyLeaderLinksDialog";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { DEMO_SURVEYS } from "@/data/surveys/demoSurveys";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const surveysTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="surveys-header"]',
    title: '📋 Pesquisas Eleitorais',
    content: 'Crie e gerencie pesquisas de opinião para coletar dados importantes dos seus contatos e lideranças.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="surveys-create-btn"]',
    title: '➕ Nova Pesquisa',
    content: 'Clique aqui para criar uma nova pesquisa. Você pode usar IA para gerar perguntas automaticamente!',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="surveys-stats"]',
    title: '📊 Estatísticas',
    content: 'Acompanhe o total de pesquisas criadas, quantas estão ativas e o total de respostas coletadas.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="surveys-filters"]',
    title: '🔍 Filtros',
    content: 'Busque pesquisas pelo título ou filtre por status (rascunho, ativa, encerrada).',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="surveys-list"]',
    title: '📝 Lista de Pesquisas',
    content: 'Cada card mostra título, descrição, número de respostas e ações disponíveis: editar, ver resultados, gerar links para líderes e visualizar.',
    placement: 'top',
  },
];

export default function Surveys() {
  const navigate = useNavigate();
  const { data: dbSurveys, isLoading } = useSurveys();
  const deleteSurvey = useDeleteSurvey();
  const { restartTutorial } = useTutorial("surveys", surveysTutorialSteps);
  const { isDemoMode } = useDemoMask();

  const surveys = isDemoMode ? [...DEMO_SURVEYS, ...(dbSurveys || [])] : dbSurveys;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [leaderLinksDialogOpen, setLeaderLinksDialogOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);

  const filteredSurveys = surveys?.filter(survey => {
    const matchesSearch = survey.titulo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || survey.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Ativa</Badge>;
      case "closed":
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Encerrada</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Rascunho</Badge>;
    }
  };

  const handleOpenLeaderLinks = (survey: Survey) => {
    setSelectedSurvey(survey);
    setLeaderLinksDialogOpen(true);
  };

  const handleDelete = (survey: Survey) => {
    setSurveyToDelete(survey);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (surveyToDelete) {
      deleteSurvey.mutate(surveyToDelete.id);
      setDeleteDialogOpen(false);
      setSurveyToDelete(null);
    }
  };

  const stats = {
    total: surveys?.length || 0,
    active: surveys?.filter(s => s.status === "active").length || 0,
    totalResponses: surveys?.reduce((acc, s) => acc + s.total_respostas, 0) || 0,
  };

  return (
    <>
      <TutorialOverlay page="surveys" />
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-tutorial="surveys-header">
          <div>
            <PageHeader icon={ClipboardList} title="Pesquisas Eleitorais" dataTutorial="surveys-header">
              <TutorialButton onClick={restartTutorial} />
            </PageHeader>
            <p className="text-muted-foreground">Gerencie pesquisas de opinião e análise de resultados</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} data-tutorial="surveys-create-btn">
            <Plus className="h-4 w-4 mr-2" />
            Nova Pesquisa
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-tutorial="surveys-stats">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ClipboardList className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pesquisas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pesquisas Ativas</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Respostas</p>
                <p className="text-2xl font-bold">{stats.totalResponses}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4" data-tutorial="surveys-filters">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pesquisa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativa</SelectItem>
              <SelectItem value="closed">Encerrada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Surveys Grid */}
        {isLoading && !isDemoMode ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tutorial="surveys-list">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-6 bg-muted rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-muted rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSurveys.length === 0 ? (
          <Card data-tutorial="surveys-list">
            <CardContent className="p-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma pesquisa encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Crie sua primeira pesquisa eleitoral"}
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Pesquisa
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-tutorial="surveys-list">
            {filteredSurveys.map((survey) => (
              <Card key={survey.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-2">{survey.titulo}</CardTitle>
                    {getStatusBadge(survey.status)}
                  </div>
                  {survey.descricao && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{survey.descricao}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Respostas</span>
                    <span className="font-medium">{survey.total_respostas}</span>
                  </div>

                  {survey.data_inicio && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Período</span>
                      <span className="font-medium">
                        {format(new Date(survey.data_inicio), "dd/MM/yyyy", { locale: ptBR })}
                        {survey.data_fim && ` - ${format(new Date(survey.data_fim), "dd/MM/yyyy", { locale: ptBR })}`}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/surveys/${survey.id}/edit`)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/surveys/${survey.id}/results`)}
                    >
                      <BarChart3 className="h-4 w-4 mr-1" />
                      Resultados
                    </Button>
                    {survey.status === "active" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLeaderLinks(survey)}
                        >
                          <Link2 className="h-4 w-4 mr-1" />
                          Links
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/pesquisa/${survey.slug}`, "_blank")}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(survey)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateSurveyDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(survey) => navigate(`/surveys/${survey.id}/edit`)}
      />

      {selectedSurvey && (
        <SurveyLeaderLinksDialog
          open={leaderLinksDialogOpen}
          onOpenChange={setLeaderLinksDialogOpen}
          survey={selectedSurvey}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pesquisa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a pesquisa "{surveyToDelete?.titulo}"?
              Esta ação não pode ser desfeita e todas as respostas serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
