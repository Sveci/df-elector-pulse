import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar, Users, Edit, Trash2, MoreVertical, Target, Search, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePrograms } from "@/hooks/programs/usePrograms";
import { AddProgramDialog } from "@/components/programs/AddProgramDialog";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { EditProgramDialog } from "@/components/programs/EditProgramDialog";
import { DeleteProgramDialog } from "@/components/programs/DeleteProgramDialog";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const projectsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="projects-header"]',
    title: "Programas",
    content: "Gerencie os programas oficiais e acompanhe seu impacto na comunidade.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="projects-create"]',
    title: "Novo Programa",
    content: "Crie novos programas definindo nome, descrição, status e data de início.",
    placement: "left",
  },
  {
    target: '[data-tutorial="projects-filters"]',
    title: "Filtros",
    content: "Busque programas por nome ou filtre por status (Ativo, Em Planejamento, Inativo).",
    placement: "bottom",
  },
];

const Projects = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const { data: programs = [], isLoading } = usePrograms();
  const { isDemoMode, m } = useDemoMask();
  const { restartTutorial } = useTutorial("projects", projectsTutorialSteps);

  const filteredPrograms = programs.filter(program => {
    const matchesSearch = program.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (program.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesStatus = selectedStatus === "all" || program.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[date.getMonth()]}/${date.getFullYear()}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <TutorialOverlay page="projects" />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" data-tutorial="projects-header">
          <div>
            <PageHeader icon={Target} title="Programas" subtitle="Acompanhe os programas oficiais e seu impacto na comunidade">
              <TutorialButton onClick={restartTutorial} />
            </PageHeader>
          </div>
          <AddProgramDialog>
            <Button data-tutorial="projects-create">
              <Plus className="h-4 w-4 mr-2" />
              Novo Programa
            </Button>
          </AddProgramDialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6" data-tutorial="projects-filters">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar programas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Em Planejamento">Em Planejamento</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Programs Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredPrograms.map((program) => (
              <Card key={program.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <CardTitle className="text-lg pr-2">{isDemoMode ? m.platformName(program.nome) : program.nome}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={program.status === "Ativo" ? "default" : "secondary"}
                        className={program.status === "Ativo" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                      >
                        {program.status}
                      </Badge>
                      {!isDemoMode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <EditProgramDialog program={program}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                          </EditProgramDialog>
                          <DeleteProgramDialog programId={program.id} programName={program.nome}>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DeleteProgramDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <CardDescription>{isDemoMode ? m.observation(program.descricao) : program.descricao}</CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{m.number(program.impacto, program.nome).toLocaleString()}</span>
                      <span className="text-muted-foreground">pessoas impactadas</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Início: {formatMonth(program.inicio)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPrograms.length === 0 && (
          <div className="text-center py-12">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Nenhum programa encontrado
            </h3>
            <p className="text-muted-foreground mb-4">
              {programs.length === 0
                ? "Comece criando seu primeiro programa."
                : "Tente ajustar os filtros de busca."
              }
            </p>
            {programs.length === 0 && (
              <AddProgramDialog>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Programa
                </Button>
              </AddProgramDialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
