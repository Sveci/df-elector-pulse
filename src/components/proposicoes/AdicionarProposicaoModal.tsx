import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, CheckCircle2, AlertCircle, ChevronDown } from "lucide-react";
import {
  useSearchProposicoesByAutor,
  fetchDetalheCamara,
  ProposicaoBuscada,
} from "@/hooks/proposicoes/useSearchProposicoesByAutor";
import { useAddProposicao } from "@/hooks/proposicoes/useProposicoesMonitoradas";
import { useTenantContext } from "@/contexts/TenantContext";

interface AdicionarProposicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdicionarProposicaoModal({
  open,
  onOpenChange,
}: AdicionarProposicaoModalProps) {
  const { activeTenant } = useTenantContext();
  const { results, loading, error, hasMore, search, loadMore } =
    useSearchProposicoesByAutor();
  const addProposicao = useAddProposicao();

  const [nomeAutor, setNomeAutor] = useState("");
  const [casa, setCasa] = useState<"camara" | "senado" | "ambas">("ambas");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  // Pre-fill with tenant name
  useEffect(() => {
    if (open && activeTenant?.nome) {
      setNomeAutor(activeTenant.nome);
    }
  }, [open, activeTenant?.nome]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeAutor.trim()) return;
    setSelected(new Set());
    setAddedCount(0);
    search(nomeAutor, casa);
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r) => r.id)));
    }
  }

  async function handleAddSelected() {
    if (selected.size === 0) return;
    setAdding(true);
    let count = 0;

    for (const result of results.filter((r) => selected.has(r.id))) {
      try {
        const payload: any = {
          casa: result.casa,
          sigla_tipo: result.siglaTipo,
          numero: result.numero,
          ano: result.ano,
        };

        if (result.casa === "camara") {
          // Fetch full details for Câmara propositions
          const detail = await fetchDetalheCamara(result.id);
          if (detail) {
            payload.camara_id = detail.id;
            payload.ementa = detail.ementa || result.ementa;
            payload.ementa_detalhada = detail.ementaDetalhada;
            payload.url_inteiro_teor = detail.urlInteiroTeor;
            payload.cod_situacao = detail.statusProposicao?.codSituacao ?? null;
            payload.descricao_situacao = detail.statusProposicao?.descricaoSituacao ?? null;
            payload.sigla_orgao_situacao = detail.statusProposicao?.siglaOrgao ?? null;
            payload.data_situacao = detail.statusProposicao?.dataHora ?? null;
            payload.regime = detail.statusProposicao?.regime ?? null;
            payload.apreciacao = detail.statusProposicao?.descricaoApreciacao ?? null;
          } else {
            payload.camara_id = result.id;
            payload.ementa = result.ementa;
          }
        } else {
          payload.senado_codigo = result.Codigo || result.id;
          payload.ementa = result.Ementa || result.ementa || result.DescricaoIdentificacao;
        }

        await addProposicao.mutateAsync(payload);
        count++;
      } catch (err: any) {
        // Skip duplicates silently
        if (err.code !== "23505") {
          console.error("Erro ao adicionar proposição:", err);
        }
      }
    }

    setAddedCount(count);
    setAdding(false);
    setSelected(new Set());

    if (count > 0) {
      // Keep modal open to show success
    }
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setNomeAutor(activeTenant?.nome || "");
      setCasa("ambas");
      setSelected(new Set());
      setAddedCount(0);
    }, 200);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Buscar proposições por autor</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-3 pt-1">
          {/* Casa legislativa */}
          <div className="grid grid-cols-3 gap-2">
            {(["ambas", "camara", "senado"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCasa(c)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  casa === c
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-muted text-muted-foreground"
                }`}
              >
                {c === "ambas" ? "🏛️ Ambas" : c === "camara" ? "🏛️ Câmara" : "🏛️ Senado"}
              </button>
            ))}
          </div>

          {/* Nome do autor */}
          <div className="space-y-1.5">
            <Label>Nome do autor / parlamentar</Label>
            <Input
              placeholder="Ex: João Silva"
              value={nomeAutor}
              onChange={(e) => setNomeAutor(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              O nome do político vinculado a esta organização foi preenchido automaticamente.
            </p>
          </div>

          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={loading || !nomeAutor.trim()}
          >
            {loading && results.length === 0 ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</>
            ) : (
              <><Search className="h-4 w-4 mr-2" />Buscar proposições</>
            )}
          </Button>
        </form>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Success message */}
        {addedCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {addedCount} proposição(ões) adicionada(s) ao monitoramento!
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="flex flex-col gap-2 min-h-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {results.length} proposição(ões) encontrada(s)
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-xs"
              >
                {selected.size === results.length ? "Desmarcar todas" : "Selecionar todas"}
              </Button>
            </div>

            <ScrollArea className="flex-1 max-h-[340px] rounded-md border">
              <div className="divide-y">
                {results.map((prop) => (
                  <label
                    key={`${prop.casa}-${prop.id}`}
                    className="flex items-start gap-3 p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(prop.id)}
                      onCheckedChange={() => toggleSelect(prop.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {prop.siglaTipo} {prop.numero}/{prop.ano}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {prop.casa}
                        </Badge>
                      </div>
                      <p className="text-sm leading-snug line-clamp-2">
                        {prop.ementa || prop.Ementa || prop.DescricaoIdentificacao || "Sem ementa"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </ScrollArea>

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loading}
                className="w-full text-xs"
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <ChevronDown className="h-3 w-3 mr-1" />
                )}
                Carregar mais
              </Button>
            )}

            <Button
              onClick={handleAddSelected}
              disabled={selected.size === 0 || adding}
              className="w-full"
            >
              {adding ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adicionando...</>
              ) : (
                `Adicionar ${selected.size} ao monitoramento`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
