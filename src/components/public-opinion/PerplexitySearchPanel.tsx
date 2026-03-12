import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Search, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  entityName: string;
  entityId: string;
}

type SearchMode = "news_clipping" | "legislation" | "public_opinion" | "general";

const modeLabels: Record<SearchMode, string> = {
  news_clipping: "Clipping de Notícias",
  legislation: "Legislação",
  public_opinion: "Opinião Pública",
  general: "Pesquisa Geral",
};

export function PerplexitySearchPanel({ entityName, entityId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("news_clipping");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string; citations: string[]; model?: string } | null>(null);

  const handleSearch = async () => {
    const searchQuery = query.trim() || `Últimas notícias sobre ${entityName}`;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("perplexity-search", {
        body: {
          type: mode,
          query: searchQuery,
          entity_name: entityName,
          options: {
            recency: mode === "news_clipping" ? "week" : mode === "public_opinion" ? "month" : undefined,
          },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      setResult({ answer: data.answer, citations: data.citations || [], model: data.model });
    } catch (e: any) {
      toast.error(e.message || "Erro ao pesquisar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="h-4 w-4 mr-2" />
          Pesquisa Web
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pesquisa Inteligente
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Mode selector */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Tipo de pesquisa</label>
            <Select value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(modeLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Query input */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Pesquisa</label>
            <div className="flex gap-2">
              <Input
                placeholder={`Ex: Notícias sobre ${entityName}...`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading} size="icon" className="shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deixe vazio para buscar automaticamente sobre {entityName}
            </p>
          </div>

          {/* Results */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Pesquisando na web em tempo real...</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{result.answer}</ReactMarkdown>
                </div>
              </div>

              {/* Citations */}
              {result.citations.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Fontes ({result.citations.length})</p>
                  <div className="space-y-1.5">
                    {result.citations.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline truncate"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {result.model && (
                <div className="flex justify-end">
                  <Badge variant="outline" className="text-xs">
                    {result.model}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
