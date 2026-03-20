import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Users, Filter, Edit, Trash2, Search, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const segmentsTutorialSteps: Step[] = [
  { target: '[data-tutorial="seg-header"]', title: 'Segmentos', content: 'Organize contatos em grupos para campanhas direcionadas.' },
  { target: '[data-tutorial="seg-create"]', title: 'Criar Segmento', content: 'Crie um novo segmento com filtros específicos.' },
  { target: '[data-tutorial="seg-filters"]', title: 'Filtros', content: 'Busque e filtre segmentos por categoria.' },
  { target: '[data-tutorial="seg-card"]', title: 'Card do Segmento', content: 'Veja total de contatos, categorias e status.' },
  { target: '[data-tutorial="seg-actions"]', title: 'Ações', content: 'Edite ou exclua segmentos existentes.' },
];

// Mock data
const mockSegments = [
  {
    id: "1",
    name: "Apoiadores Ativos",
    description: "Segmento de contatos que demonstraram engajamento positivo",
    totalContacts: 1250,
    categories: ["Apoio", "Engajamento"],
    lastUpdated: "2024-01-15",
    status: "ativo"
  },
  {
    id: "2",
    name: "Jovens Universitários",
    description: "Estudantes universitários de 18-25 anos interessados em política",
    totalContacts: 890,
    categories: ["Educação", "Juventude"],
    lastUpdated: "2024-01-14",
    status: "ativo"
  },
  {
    id: "3",
    name: "Empresários Locais",
    description: "Empresários e empreendedores do DF",
    totalContacts: 350,
    categories: ["Economia", "Negócios"],
    lastUpdated: "2024-01-12",
    status: "inativo"
  }
];

const conversationCategories = [
  "Apoio", "Crítica", "Dúvida", "Sugestão", "Reclamação",
  "Educação", "Saúde", "Segurança", "Economia", "Infraestrutura",
  "Juventude", "Mulheres", "Idosos", "Negócios", "Engajamento"
];

const Segments = () => {
  const [segments, setSegments] = useState(mockSegments);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { restartTutorial } = useTutorial("segments", segmentsTutorialSteps);
  const [newSegment, setNewSegment] = useState({
    name: "",
    description: "",
    categories: [] as string[],
    filters: {
      ageRange: { min: "", max: "" },
      location: "",
      engagementLevel: "",
      lastInteraction: ""
    }
  });
  const { toast } = useToast();

  const filteredSegments = segments.filter(segment => {
    const matchesSearch = segment.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         segment.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" ||
                           segment.categories.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const handleCreateSegment = () => {
    if (!newSegment.name || !newSegment.description) {
      toast({
        title: "Erro",
        description: "Nome e descrição são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    const segment = {
      id: (segments.length + 1).toString(),
      name: newSegment.name,
      description: newSegment.description,
      categories: newSegment.categories,
      totalContacts: Math.floor(Math.random() * 1000) + 100,
      lastUpdated: new Date().toISOString().split('T')[0],
      status: "ativo" as const
    };

    setSegments([...segments, segment]);
    setNewSegment({
      name: "",
      description: "",
      categories: [],
      filters: {
        ageRange: { min: "", max: "" },
        location: "",
        engagementLevel: "",
        lastInteraction: ""
      }
    });
    setIsCreateDialogOpen(false);

    toast({
      title: "Sucesso",
      description: "Segmento criado com sucesso!"
    });
  };

  const handleDeleteSegment = (id: string) => {
    setSegments(segments.filter(s => s.id !== id));
    toast({
      title: "Sucesso",
      description: "Segmento removido com sucesso!"
    });
  };

  const toggleCategory = (category: string) => {
    const categories = newSegment.categories.includes(category)
      ? newSegment.categories.filter(c => c !== category)
      : [...newSegment.categories, category];

    setNewSegment({ ...newSegment, categories });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <TutorialOverlay page="segments" />
      {/* Header */}
      <div className="flex justify-between items-center mb-6" data-tutorial="seg-header">
        <PageHeader icon={Target} title="Segmentos" subtitle="Organize seus contatos em segmentos para campanhas direcionadas" dataTutorial="seg-header" />

        <div className="flex items-center gap-2">
          <TutorialButton onClick={restartTutorial} />
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" data-tutorial="seg-create">
                <Plus className="h-4 w-4" />
                Criar Segmento
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Segmento</DialogTitle>
              <DialogDescription>
                Configure os filtros e critérios para seu novo segmento
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
                <TabsTrigger value="filters">Filtros Avançados</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Segmento</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Apoiadores Ativos"
                    value={newSegment.name}
                    onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o propósito deste segmento..."
                    value={newSegment.description}
                    onChange={(e) => setNewSegment({ ...newSegment, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Categorias de Conversa</Label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {conversationCategories.map((category) => (
                      <label
                        key={category}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newSegment.categories.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="filters" className="space-y-4">
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertDescription>
                    Use os filtros abaixo para refinar seu segmento. Quanto mais específico, mais direcionadas serão suas campanhas.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Idade Mínima</Label>
                    <Input
                      type="number"
                      placeholder="18"
                      value={newSegment.filters.ageRange.min}
                      onChange={(e) => setNewSegment({
                        ...newSegment,
                        filters: {
                          ...newSegment.filters,
                          ageRange: { ...newSegment.filters.ageRange, min: e.target.value }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade Máxima</Label>
                    <Input
                      type="number"
                      placeholder="65"
                      value={newSegment.filters.ageRange.max}
                      onChange={(e) => setNewSegment({
                        ...newSegment,
                        filters: {
                          ...newSegment.filters,
                          ageRange: { ...newSegment.filters.ageRange, max: e.target.value }
                        }
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Localização</Label>
                  <Select
                    value={newSegment.filters.location}
                    onValueChange={(value) => setNewSegment({
                      ...newSegment,
                      filters: { ...newSegment.filters, location: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma região" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brasilia">Brasília</SelectItem>
                      <SelectItem value="taguatinga">Taguatinga</SelectItem>
                      <SelectItem value="ceilandia">Ceilândia</SelectItem>
                      <SelectItem value="samambaia">Samambaia</SelectItem>
                      <SelectItem value="planaltina">Planaltina</SelectItem>
                      <SelectItem value="sobradinho">Sobradinho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Nível de Engajamento</Label>
                  <Select
                    value={newSegment.filters.engagementLevel}
                    onValueChange={(value) => setNewSegment({
                      ...newSegment,
                      filters: { ...newSegment.filters, engagementLevel: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alto">Alto Engajamento</SelectItem>
                      <SelectItem value="medio">Médio Engajamento</SelectItem>
                      <SelectItem value="baixo">Baixo Engajamento</SelectItem>
                      <SelectItem value="inativo">Inativos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Última Interação</Label>
                  <Select
                    value={newSegment.filters.lastInteraction}
                    onValueChange={(value) => setNewSegment({
                      ...newSegment,
                      filters: { ...newSegment.filters, lastInteraction: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="90d">Últimos 90 dias</SelectItem>
                      <SelectItem value="1y">Último ano</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateSegment}>
                Criar Segmento
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6" data-tutorial="seg-filters">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar segmentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {conversationCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSegments.map((segment, index) => (
          <Card key={segment.id} className="relative" data-tutorial={index === 0 ? "seg-card" : undefined}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{segment.name}</CardTitle>
                <div className="flex gap-1" data-tutorial={index === 0 ? "seg-actions" : undefined}>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSegment(segment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>{segment.description}</CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{segment.totalContacts.toLocaleString()}</span>
                  <span className="text-gray-500">contatos</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {segment.categories.map((category) => (
                    <Badge key={category} variant="secondary" className="text-xs">
                      {category}
                    </Badge>
                  ))}
                </div>

                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>Atualizado em {segment.lastUpdated}</span>
                  <Badge
                    variant={segment.status === "ativo" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {segment.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSegments.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum segmento encontrado
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory !== "all"
              ? "Tente ajustar os filtros de busca."
              : "Crie seu primeiro segmento para organizar seus contatos."
            }
          </p>
          {!searchTerm && selectedCategory === "all" && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              Criar Primeiro Segmento
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default Segments;