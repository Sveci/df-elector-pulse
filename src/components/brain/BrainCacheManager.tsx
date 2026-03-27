import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useBrainCache, useAddBrainCacheEntry, useToggleBrainCacheEntry, useDeleteBrainCacheEntry, useUpdateBrainCacheEntry, type BrainCacheEntry } from "@/hooks/useBrainCache";
import { Plus, Search, Trash2, MessageSquare, Database, Loader2, Eye, EyeOff, Bot, User, BookOpen, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORIAS = [
  { value: "geral", label: "Geral" },
  { value: "proposicoes", label: "Proposições" },
  { value: "eventos", label: "Eventos" },
  { value: "liderancas", label: "Lideranças" },
  { value: "contatos", label: "Contatos" },
  { value: "campanhas", label: "Campanhas" },
  { value: "materiais", label: "Materiais" },
  { value: "pesquisas", label: "Pesquisas" },
  { value: "procedimentos", label: "Procedimentos" },
];

const ORIGEM_ICONS: Record<string, typeof Bot> = {
  ai: Bot,
  manual: User,
  kb: BookOpen,
  flow: MessageSquare,
};

const ORIGEM_LABELS: Record<string, string> = {
  ai: "IA",
  manual: "Manual",
  kb: "Base de Conhecimento",
  flow: "Fluxo",
};

export function BrainCacheManager() {
  const { data: entries, isLoading } = useBrainCache();
  const addEntry = useAddBrainCacheEntry();
  const toggleEntry = useToggleBrainCacheEntry();
  const deleteEntry = useDeleteBrainCacheEntry();
  const updateEntry = useUpdateBrainCacheEntry();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BrainCacheEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategoria, setFilterCategoria] = useState("todas");
  const [filterOrigem, setFilterOrigem] = useState("todas");

  // Form state
  const [formPergunta, setFormPergunta] = useState("");
  const [formResposta, setFormResposta] = useState("");
  const [formCategoria, setFormCategoria] = useState("geral");

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entries.filter((e) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q ||
        e.pergunta_original.toLowerCase().includes(q) ||
        e.resposta.toLowerCase().includes(q);
      const matchesCat = filterCategoria === "todas" || e.categoria === filterCategoria;
      const matchesOrigem = filterOrigem === "todas" || e.origem === filterOrigem;
      return matchesSearch && matchesCat && matchesOrigem;
    });
  }, [entries, searchTerm, filterCategoria, filterOrigem]);

  const handleAdd = async () => {
    if (!formPergunta.trim() || !formResposta.trim()) return;
    await addEntry.mutateAsync({
      pergunta: formPergunta.trim(),
      resposta: formResposta.trim(),
      categoria: formCategoria,
    });
    setFormPergunta("");
    setFormResposta("");
    setFormCategoria("geral");
    setShowAddDialog(false);
  };

  const stats = useMemo(() => {
    if (!entries) return { total: 0, ativos: 0, manuais: 0, ia: 0 };
    return {
      total: entries.length,
      ativos: entries.filter(e => e.ativo).length,
      manuais: entries.filter(e => e.origem === "manual").length,
      ia: entries.filter(e => e.origem === "ai").length,
    };
  }, [entries]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Gerenciar Cache de Respostas</h3>
        </div>
        <Button onClick={() => setShowAddDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Adicionar FAQ
        </Button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-500">{stats.ativos}</p>
          <p className="text-xs text-muted-foreground">Ativos</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-blue-500">{stats.manuais}</p>
          <p className="text-xs text-muted-foreground">Manuais</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-amber-500">{stats.ia}</p>
          <p className="text-xs text-muted-foreground">Aprendidos</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pergunta ou resposta..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {CATEGORIAS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas origens</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="ai">IA</SelectItem>
            <SelectItem value="kb">KB</SelectItem>
            <SelectItem value="flow">Fluxo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Showing count */}
      {entries && filtered.length !== entries.length && (
        <p className="text-sm text-muted-foreground">
          Mostrando {filtered.length} de {entries.length} entradas
        </p>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">
              {entries?.length === 0
                ? "Nenhuma entrada no cache. Adicione perguntas frequentes para acelerar as respostas!"
                : "Nenhum resultado encontrado para os filtros selecionados."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((entry) => {
            const OrigemIcon = ORIGEM_ICONS[entry.origem] || Bot;
            return (
              <Card key={entry.id} className={!entry.ativo ? "opacity-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs gap-1">
                          <OrigemIcon className="h-3 w-3" />
                          {ORIGEM_LABELS[entry.origem] || entry.origem}
                        </Badge>
                        {entry.categoria && (
                          <Badge variant="secondary" className="text-xs">
                            {entry.categoria}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Usada {entry.vezes_utilizada}x
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · Confiança: {Math.round(entry.score_confianca * 100)}%
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          <span className="text-muted-foreground">P:</span> {entry.pergunta_original}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          <span className="text-foreground font-medium">R:</span> {entry.resposta}
                        </p>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Criada em {format(parseISO(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {entry.ultima_utilizacao && (
                          <> · Última uso: {format(parseISO(entry.ultima_utilizacao), "dd/MM/yyyy", { locale: ptBR })}</>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={entry.ativo}
                        onCheckedChange={(checked) => toggleEntry.mutate({ id: entry.id, ativo: checked })}
                        title={entry.ativo ? "Desativar" : "Ativar"}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover entrada</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover esta pergunta/resposta do cache? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteEntry.mutate(entry.id)}>
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Pergunta/Resposta</DialogTitle>
            <DialogDescription>
              Cadastre uma FAQ para que o assistente responda instantaneamente sem usar IA.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Pergunta</label>
              <Textarea
                placeholder="Ex: Qual o horário de funcionamento do gabinete?"
                value={formPergunta}
                onChange={(e) => setFormPergunta(e.target.value)}
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Resposta</label>
              <Textarea
                placeholder="Ex: O gabinete funciona de segunda a sexta, das 8h às 18h."
                value={formResposta}
                onChange={(e) => setFormResposta(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Categoria</label>
              <Select value={formCategoria} onValueChange={setFormCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleAdd}
              disabled={!formPergunta.trim() || !formResposta.trim() || addEntry.isPending}
            >
              {addEntry.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Salvando...</>
              ) : (
                <><Plus className="h-4 w-4 mr-1" /> Adicionar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
