import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BookOpen, Plus, Search, MoreVertical, Trash2, FileText, Clock, CheckCircle2,
  AlertCircle, Brain, RefreshCw, Database,
} from "lucide-react";
import { useKBDocuments, useDeleteKBDocument, KB_CATEGORIES } from "@/hooks/useKnowledgeBase";
import { AddKBDocumentDialog } from "./AddKBDocumentDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  processing: { label: "Processando", color: "bg-yellow-100 text-yellow-800", icon: RefreshCw },
  ready: { label: "Pronto", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  error: { label: "Erro", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

export function KnowledgeBasePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const { data: documents = [], isLoading } = useKBDocuments();
  const deleteDocument = useDeleteKBDocument();

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesCategory = selectedCategory === "all" || doc.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalChunks = documents.reduce((sum, d) => sum + (d.total_chunks || 0), 0);
  const readyDocs = documents.filter((d) => d.status === "ready").length;

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Base de Conhecimento</h1>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Cérebro documental do sistema — alimenta IA, WhatsApp e Agente com fatos verificáveis
            </p>
          </div>
          <AddKBDocumentDialog>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Documento
            </Button>
          </AddKBDocumentDialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <Database className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{documents.length}</p>
                <p className="text-sm text-muted-foreground">Documentos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalChunks}</p>
                <p className="text-sm text-muted-foreground">Fragmentos indexados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{readyDocs}</p>
                <p className="text-sm text-muted-foreground">Prontos para uso</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {KB_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Documents Grid */}
        {!isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const status = statusConfig[doc.status] || statusConfig.processing;
              const StatusIcon = status.icon;
              const categoryLabel = KB_CATEGORIES.find((c) => c.value === doc.category)?.label || doc.category;

              return (
                <Card key={doc.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileText className="h-5 w-5 text-primary shrink-0" />
                        <CardTitle className="text-base truncate">{doc.title}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                onSelect={(e) => e.preventDefault()}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O documento "{doc.title}" e todos os seus fragmentos serão removidos permanentemente da base de conhecimento.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteDocument.mutate(doc.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {doc.description && (
                      <CardDescription className="line-clamp-2">{doc.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="outline">{categoryLabel}</Badge>
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{doc.total_chunks} fragmentos</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredDocs.length === 0 && (
          <div className="text-center py-12">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {documents.length === 0 ? "Base de conhecimento vazia" : "Nenhum documento encontrado"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {documents.length === 0
                ? "Adicione documentos para que a IA possa responder perguntas com base em fatos verificáveis."
                : "Tente ajustar os filtros de busca."}
            </p>
            {documents.length === 0 && (
              <AddKBDocumentDialog>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Documento
                </Button>
              </AddKBDocumentDialog>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
