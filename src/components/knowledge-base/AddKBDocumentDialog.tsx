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
import { FileText, Upload, Loader2, Globe } from "lucide-react";
import { useCreateKBDocument, KB_CATEGORIES } from "@/hooks/useKnowledgeBase";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
}

export function AddKBDocumentDialog({ children }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("geral");
  const [content, setContent] = useState("");
  const [inputMethod, setInputMethod] = useState<"text" | "file" | "url">("text");
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [scrapedUrl, setScrapedUrl] = useState("");
  const createDocument = useCreateKBDocument();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const isPDF = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPDF) {
      setExtracting(true);
      setContent("");
      try {
        const formData = new FormData();
        formData.append("file", file);

        const { data, error } = await supabase.functions.invoke("kb-extract-pdf", {
          body: formData,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const extractedText = data?.text || "";
        if (extractedText.length < 50) {
          toast.error("Não foi possível extrair texto suficiente do PDF.");
          return;
        }

        setContent(extractedText);
        if (!title) setTitle(file.name.replace(/\.pdf$/i, ""));
        toast.success(`PDF processado: ${extractedText.length.toLocaleString()} caracteres extraídos`);
      } catch (err: any) {
        console.error("PDF extraction error:", err);
        toast.error(err.message || "Erro ao processar o PDF");
      } finally {
        setExtracting(false);
      }
      return;
    }

    // Text-based files
    if (
      file.type === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")
    ) {
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
      file.type === "text/html" || file.name.endsWith(".html") ||
      file.name.endsWith(".sql")
    ) {
      const text = await file.text();
      setContent(text);
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    } else {
      try {
        const text = await file.text();
        setContent(text);
        if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
      } catch {
        setContent("");
        toast.error("Formato de arquivo não suportado.");
      }
    }
  };

  const handleScrapeUrl = async () => {
    if (!urlInput.trim()) return;

    setExtracting(true);
    setContent("");
    setScrapedUrl("");

    try {
      const { data, error } = await supabase.functions.invoke("kb-scrape-url", {
        body: { url: urlInput.trim() },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao extrair conteúdo da URL");

      setContent(data.content);
      setScrapedUrl(data.url);
      if (!title && data.title) setTitle(data.title);
      toast.success(`Página extraída: ${data.content.length.toLocaleString()} caracteres (via ${data.source})`);
    } catch (err: any) {
      console.error("URL scrape error:", err);
      toast.error(err.message || "Erro ao extrair conteúdo da URL");
    } finally {
      setExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;

    await createDocument.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      content: content.trim(),
      file_name: fileName || (scrapedUrl ? urlInput : undefined),
      file_type: fileName ? fileName.split(".").pop() : (scrapedUrl ? "url" : undefined),
      file_size_bytes: new Blob([content]).size,
    });

    setTitle("");
    setDescription("");
    setCategory("geral");
    setContent("");
    setFileName("");
    setUrlInput("");
    setScrapedUrl("");
    setOpen(false);
  };

  const isValid = title.trim() && content.trim() && !extracting;

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

          <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as "text" | "file" | "url")}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                Colar Texto
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                Enviar Arquivo
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1">
                <Globe className="h-4 w-4 mr-2" />
                Importar URL
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
                    Suporta: .pdf, .txt, .md, .json, .csv, .html, .sql
                  </p>
                  <Input
                    type="file"
                    accept=".pdf,.txt,.md,.json,.csv,.html,.sql"
                    onChange={handleFileUpload}
                    className="max-w-xs mx-auto"
                    disabled={extracting}
                  />
                </div>

                {extracting && (
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Extraindo texto do PDF com IA...</p>
                      <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
                    </div>
                  </div>
                )}

                {fileName && !extracting && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      ({content.length.toLocaleString()} caracteres)
                    </span>
                  </div>
                )}
                {content && !extracting && (
                  <div className="space-y-2">
                    <Label>Prévia do conteúdo extraído</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>URL da página</Label>
                  <div className="flex gap-2">
                    <Input
                      type="url"
                      placeholder="https://exemplo.com/pagina"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      disabled={extracting}
                      onKeyDown={(e) => e.key === "Enter" && handleScrapeUrl()}
                    />
                    <Button
                      type="button"
                      onClick={handleScrapeUrl}
                      disabled={!urlInput.trim() || extracting}
                      variant="secondary"
                    >
                      {extracting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Globe className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O sistema irá extrair o conteúdo principal da página para uso como base de conhecimento.
                  </p>
                </div>

                {extracting && (
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Extraindo conteúdo da página...</p>
                      <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
                    </div>
                  </div>
                )}

                {scrapedUrl && !extracting && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium truncate">{scrapedUrl}</span>
                    <span className="text-xs text-muted-foreground">
                      ({content.length.toLocaleString()} caracteres)
                    </span>
                  </div>
                )}

                {content && !extracting && inputMethod === "url" && (
                  <div className="space-y-2">
                    <Label>Conteúdo extraído (editável)</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={10}
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
