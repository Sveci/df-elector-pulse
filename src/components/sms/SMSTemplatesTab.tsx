import { useState } from "react";
import { Plus, Pencil, Trash2, MessageSquare } from "lucide-react";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useSMSTemplates, useUpdateSMSTemplate, useDeleteSMSTemplate } from "@/hooks/useSMSTemplates";
import { SMSTemplateEditorDialog } from "./SMSTemplateEditorDialog";
import { Skeleton } from "@/components/ui/skeleton";

interface SMSTemplatesTabProps {
  searchTerm?: string;
}

export function SMSTemplatesTab({ searchTerm = "" }: SMSTemplatesTabProps) {
  const { isDemoMode, m } = useDemoMask();
  const { data: templates, isLoading } = useSMSTemplates();
  const updateTemplate = useUpdateSMSTemplate();
  const deleteTemplate = useDeleteSMSTemplate();

  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  const filteredTemplates = templates?.filter(
    (template) =>
      template.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.categoria.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.mensagem.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedTemplates = filteredTemplates?.reduce((acc, template) => {
    if (!acc[template.categoria]) {
      acc[template.categoria] = [];
    }
    acc[template.categoria].push(template);
    return acc;
  }, {} as Record<string, typeof templates>);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await updateTemplate.mutateAsync({ id, data: { is_active: !isActive } });
  };

  const handleEdit = (id: string) => {
    setSelectedTemplate(id);
    setEditorOpen(true);
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

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setEditorOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((j) => (
                <Skeleton key={j} className="h-48" />
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

      {groupedTemplates && Object.entries(groupedTemplates).map(([categoria, categoryTemplates]) => (
        <div key={categoria} className="space-y-4">
          <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {categoria}
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categoryTemplates?.map((template) => (
              <Card key={template.id} className={!template.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{isDemoMode ? m.platformName(template.nome) : template.nome}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {template.slug}
                      </Badge>
                    </div>
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={() => handleToggleActive(template.id, template.is_active)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {isDemoMode ? m.observation(template.mensagem) : template.mensagem}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    {template.mensagem.length}/160 caracteres
                  </div>
                  {template.variaveis && template.variaveis.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variaveis.map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEdit(template.id)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
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

      <SMSTemplateEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        templateId={selectedTemplate}
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
