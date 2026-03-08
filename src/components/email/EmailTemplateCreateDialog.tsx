import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Eye, Code } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateEmailTemplate } from "@/hooks/useEmailTemplates";

const CATEGORIAS = [
  { value: "evento", label: "Eventos" },
  { value: "captacao", label: "Captação" },
  { value: "lideranca", label: "Liderança" },
  { value: "lider", label: "Link de Líder" },
  { value: "visita", label: "Visita ao Gabinete" },
  { value: "sistema", label: "Sistema" },
  { value: "geral", label: "Geral" },
];

interface EmailTemplateCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplateCreateDialog({
  open,
  onOpenChange,
}: EmailTemplateCreateDialogProps) {
  const createTemplate = useCreateEmailTemplate();
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [assunto, setAssunto] = useState("");
  const [categoria, setCategoria] = useState("geral");
  const [conteudoHtml, setConteudoHtml] = useState("");
  const [previewTab, setPreviewTab] = useState<"code" | "preview">("code");

  useEffect(() => {
    if (open) {
      setNome("");
      setSlug("");
      setAssunto("");
      setCategoria("geral");
      setConteudoHtml("");
      setPreviewTab("code");
    }
  }, [open]);

  const generateSlug = () => {
    const generated = nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generated);
  };

  const detectedVariables = [
    ...new Set(
      (conteudoHtml.match(/{{(\w+)}}/g) || [])
        .concat(assunto.match(/{{(\w+)}}/g) || [])
        .map((v) => v.replace(/{{|}}/g, ""))
    ),
  ];

  const handleSave = () => {
    createTemplate.mutate(
      {
        slug,
        nome,
        assunto,
        conteudo_html: conteudoHtml,
        categoria,
        variaveis: detectedVariables,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo Template de Email</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Confirmação de Evento"
                onBlur={() => {
                  if (!slug) generateSlug();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="confirmacao-evento"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Assunto do Email</Label>
              <Input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Inscrição Confirmada: {{evento_nome}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
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
            </div>
          </div>

          {/* Variables */}
          {detectedVariables.length > 0 && (
            <div className="space-y-2">
              <Label>Variáveis Detectadas</Label>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((v) => (
                  <Badge key={v} variant="secondary">
                    {`{{${v}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* HTML Editor with Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conteúdo HTML</Label>
              <Tabs value={previewTab} onValueChange={(v) => setPreviewTab(v as "code" | "preview")}>
                <TabsList className="h-8">
                  <TabsTrigger value="code" className="text-xs gap-1">
                    <Code className="h-3 w-3" />
                    Código
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs gap-1">
                    <Eye className="h-3 w-3" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {previewTab === "code" ? (
              <Textarea
                value={conteudoHtml}
                onChange={(e) => setConteudoHtml(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder="<!DOCTYPE html><html><body>...</body></html>"
              />
            ) : (
              <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                <iframe
                  srcDoc={conteudoHtml}
                  className="w-full h-[300px] border-0"
                  title="Email Preview"
                  sandbox="allow-same-origin"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={createTemplate.isPending || !nome || !slug || !assunto || !conteudoHtml}
          >
            {createTemplate.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Criar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
