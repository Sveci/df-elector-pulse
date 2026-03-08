import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WhatsAppTemplate,
  useUpdateWhatsAppTemplate,
  useCreateWhatsAppTemplate,
} from "@/hooks/useWhatsAppTemplates";

interface WhatsAppTemplateEditorDialogProps {
  template: WhatsAppTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating?: boolean;
}

const CATEGORIAS = [
  { value: "visita", label: "Visita ao Gabinete" },
  { value: "evento", label: "Eventos" },
  { value: "captacao", label: "Captação" },
  { value: "lideranca", label: "Lideranças" },
  { value: "geral", label: "Geral" },
];

export function WhatsAppTemplateEditorDialog({
  template,
  open,
  onOpenChange,
  isCreating = false,
}: WhatsAppTemplateEditorDialogProps) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [mensagem, setMensagem] = useState("");
  const [isActive, setIsActive] = useState(true);

  const updateTemplate = useUpdateWhatsAppTemplate();
  const createTemplate = useCreateWhatsAppTemplate();

  useEffect(() => {
    if (template && !isCreating) {
      setNome(template.nome);
      setSlug(template.slug);
      setCategoria(template.categoria);
      setMensagem(template.mensagem);
      setIsActive(template.is_active);
    } else if (isCreating) {
      setNome("");
      setSlug("");
      setCategoria("geral");
      setMensagem("");
      setIsActive(true);
    }
  }, [template, isCreating, open]);

  const generateSlug = () => {
    const generated = nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generated);
  };

  const detectedVariables = (mensagem.match(/{{(\w+)}}/g) || []).map((v) =>
    v.replace(/{{|}}/g, "")
  );

  const handleSave = () => {
    if (isCreating) {
      createTemplate.mutate(
        {
          slug,
          nome,
          mensagem,
          categoria,
          variaveis: [...new Set(detectedVariables)],
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else if (template) {
      updateTemplate.mutate(
        {
          id: template.id,
          data: {
            nome,
            mensagem,
            variaveis: [...new Set(detectedVariables)],
            is_active: isActive,
          },
        },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const isPending = updateTemplate.isPending || createTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isCreating ? "Novo Template WhatsApp" : "Editar Template"}
          </DialogTitle>
          <DialogDescription>
            {isCreating
              ? "Crie um novo template de mensagem WhatsApp."
              : `Modifique o conteúdo da mensagem. Use {{variavel}} para variáveis dinâmicas.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Link do Formulário de Visita"
                onBlur={() => {
                  if (isCreating && !slug) generateSlug();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="link-formulario-visita"
                disabled={!isCreating}
                className={!isCreating ? "bg-muted" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            {isCreating ? (
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={template?.categoria || ""}
                disabled
                className="bg-muted capitalize"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Olá {{nome}}! Você está convidado..."
              rows={10}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use *texto* para negrito no WhatsApp. Use {"{{variavel}}"} para dados dinâmicos.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Variáveis Detectadas</Label>
            <div className="flex flex-wrap gap-2">
              {detectedVariables.length > 0 ? (
                [...new Set(detectedVariables)].map((v, i) => (
                  <Badge key={i} variant="secondary">
                    {`{{${v}}}`}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Nenhuma variável encontrada
                </span>
              )}
            </div>
          </div>

          {!isCreating && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Template Ativo</Label>
                <p className="text-sm text-muted-foreground">
                  Templates inativos não podem ser usados para envio
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}

          <div className="rounded-lg border p-4 bg-muted/50">
            <Label className="text-sm font-medium">Pré-visualização</Label>
            <div className="mt-2 p-3 bg-background rounded-lg whitespace-pre-wrap text-sm">
              {mensagem || "Digite uma mensagem para ver a pré-visualização"}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || !nome || !mensagem || (isCreating && !slug)}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCreating ? "Criar Template" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
