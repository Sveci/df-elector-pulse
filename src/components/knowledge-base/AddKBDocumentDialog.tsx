import { useState, ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Upload, Loader2 } from "lucide-react";
import { useCreateKBDocument, KB_CATEGORIES } from "@/hooks/useKnowledgeBase";

interface Props {
  children: ReactNode;
}

export function AddKBDocumentDialog({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("geral");
  const [content, setContent] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "file">("text");
  const [fileName, setFileName] = useState("");
  const createDocument = useCreateKBDocument();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    // Read text content from file
    if (file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
      const text = await file.text();
      setContent(text);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } else if (file.type === "application/json" || file.name.endsWith(".json")) {
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        setContent(JSON.stringify(parsed, null, 2));
      } catch {
        setContent(text);
      }
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } else if (
      file.type === "text/csv" || file.name.endsWith(".csv") ||
      file.type === "text/html" || file.name.endsWith(".html")
    ) {
      const text = await file.text();
      setContent(text);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } else {
      // For other file types, try to read as text
      try {
        const text = await file.text();
        setContent(text);
        if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
      } catch {
        setContent("");
        alert("Formato de arquivo não suportado. Use .txt, .md, .json, .csv ou .html");
      }
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    await createDocument.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      content: content.trim(),
      file_name: fileName || undefined,
      file_type: fileName ? fileName.split(".").pop() : undefined,
      file_size_bytes: new Blob([content]).size,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setCategory("geral");
    setContent("");
    setFileName("");
    setOpen(false);
  };

  const isValid = title.trim() && content.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Adicionar Documento
          </DialogTitle>
          <DialogDescription>
            Adicione um documento à base de conhecimento. A IA irá processar e indexar o conteúdo automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                placeholder="Ex: Plano de Governo 2025"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KB_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Input
              id="description"
              placeholder="Breve descrição do conteúdo do documento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as "text" | "file")}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Colar Texto
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                Enviar Arquivo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <div className="space-y-2">
                <Label>Conteúdo do documento *</Label>
                <Textarea
                  placeholder="Cole aqui o conteúdo do documento (briefing, plano de governo, FAQ, pesquisa, discurso, etc.)..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {content.length.toLocaleString()} caracteres
                  {content.length > 0 && ` (~${Math.ceil(content.split(/\s+/).length)} palavras)`}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="file" className="mt-4">
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Arraste um arquivo ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Suporta: .txt, .md, .json, .csv, .html
                  </p>
                  <Input
                    type="file"
                    accept=".txt,.md,.json,.csv,.html"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                  />
                </div>
                {fileName && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      ({content.length.toLocaleString()} caracteres)
                    </span>
                  </div>
                )}
                {content && (
                  <div className="space-y-2">
                    <Label>Prévia do conteúdo</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || createDocument.isPending}
          >
            {createDocument.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Adicionar e Processar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
