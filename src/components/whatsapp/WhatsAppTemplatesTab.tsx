import { useState } from "react";
import { Plus, Edit2, Trash2, MessageSquare, Send } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useWhatsAppTemplates,
  useUpdateWhatsAppTemplate,
  useDeleteWhatsAppTemplate,
  WhatsAppTemplate,
} from "@/hooks/useWhatsAppTemplates";
import { WhatsAppTemplateEditorDialog } from "./WhatsAppTemplateEditorDialog";
import { WhatsAppTestSendDialog } from "./WhatsAppTestSendDialog";

const CATEGORY_LABELS: Record<string, string> = {
  visita: "Visita ao Gabinete",
  evento: "Eventos",
  captacao: "Captação",
  lideranca: "Lideranças",
};

const CATEGORY_COLORS: Record<string, string> = {
  visita: "bg-blue-100 text-blue-700 border-blue-200",
  evento: "bg-green-100 text-green-700 border-green-200",
  captacao: "bg-purple-100 text-purple-700 border-purple-200",
  lideranca: "bg-amber-100 text-amber-700 border-amber-200",
};

export function WhatsAppTemplatesTab() {
  const { isDemoMode, m } = useDemoMask();
  const { data: templates, isLoading } = useWhatsAppTemplates();
  const updateTemplate = useUpdateWhatsAppTemplate();
  const deleteTemplate = useDeleteWhatsAppTemplate();
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const handleEdit = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setIsCreating(false);
    setEditorOpen(true);
  };

  const handleTest = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setTestDialogOpen(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setIsCreating(true);
    setEditorOpen(true);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateTemplate.mutateAsync({ id, data: { is_active: !isActive } });
  };

  const handleDelete = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (templateToDelete) {
      await deleteTemplate.mutateAsync(templateToDelete);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  // Group templates by category
  const groupedTemplates = templates?.reduce((acc, template) => {
    const category = template.categoria;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(template);
    return acc;
  }, {} as Record<string, WhatsAppTemplate[]>);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((j) => (
                <Skeleton key={j} className="h-24" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      {groupedTemplates &&
        Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-sm">
                {CATEGORY_LABELS[category] || category}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {categoryTemplates.length}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryTemplates.map((template) => (
                <Card
                  key={template.id}
                  className={`relative ${!template.is_active ? "opacity-60" : ""}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium truncate">
                            {isDemoMode ? m.platformName(template.nome) : template.nome}
                          </h4>
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={() => handleToggleActive(template.id, template.is_active)}
                            className="scale-75"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {isDemoMode ? m.observation(template.mensagem) : template.mensagem.substring(0, 80) + "..."}
                        </p>
                        <div className="flex items-center gap-1 mt-2">
                          {template.variaveis.slice(0, 3).map((v, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-xs px-1.5 py-0"
                            >
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                          {template.variaveis.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{template.variaveis.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(template)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Editar</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleTest(template)}
                              disabled={!template.is_active}
                            >
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Enviar Teste</TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDelete(template.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

      {(!groupedTemplates || Object.keys(groupedTemplates).length === 0) && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum template encontrado</p>
        </div>
      )}

      <WhatsAppTemplateEditorDialog
        template={selectedTemplate}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        isCreating={isCreating}
      />

      <WhatsAppTestSendDialog
        template={selectedTemplate}
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
