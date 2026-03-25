import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  searchProposicaoCamara,
  searchProposicaoSenado,
  useAddProposicao,
} from "@/hooks/proposicoes/useProposicoesMonitoradas";

interface AdicionarProposicaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TIPOS_CAMARA = [
  "PL", "PEC", "PDL", "PLP", "PLV", "MPV", "REQ", "INC", "PRC",
];
const TIPOS_SENADO = ["PL", "PEC", "PDS", "PDL", "PLP", "MPV", "RQS"];

export function AdicionarProposicaoModal({
  open,
  onOpenChange,
}: AdicionarProposicaoModalProps) {
  const [casa, setCasa] = useState<"camara" | "senado">("camara");
  const [siglaType, setSiglaType] = useState("PL");
  const [numero, setNumero] = useState("");
  const [ano, setAno] = useState(new Date().getFullYear().toString());

  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  const addProposicao = useAddProposicao();

  function resetSearch() {
    setFound(null);
    setNotFound(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!numero || !ano) return;
    setSearching(true);
    setFound(null);
    setNotFound(false);

    try {
      let result: any = null;
      if (casa === "camara") {
        result = await searchProposicaoCamara(siglaType, Number(numero), Number(ano));
      } else {
        result = await searchProposicaoSenado(siglaType, Number(numero), Number(ano));
      }

      if (result) {
        setFound(result);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleAdd() {
    if (!found) return;

    const isCamera = casa === "camara";

    const payload: any = {
      casa,
      sigla_tipo: siglaType,
      numero: Number(numero),
      ano: Number(ano),
    };

    if (isCamera) {
      payload.camara_id = found.id;
      payload.ementa = found.ementa;
      payload.ementa_detalhada = found.ementaDetalhada;
      payload.url_inteiro_teor = found.urlInteiroTeor;
      payload.cod_situacao = found.statusProposicao?.codSituacao ?? null;
      payload.descricao_situacao = found.statusProposicao?.descricaoSituacao ?? null;
      payload.sigla_orgao_situacao = found.statusProposicao?.siglaOrgao ?? null;
      payload.data_situacao = found.statusProposicao?.dataHora ?? null;
      payload.regime = found.statusProposicao?.regime ?? null;
      payload.apreciacao = found.statusProposicao?.descricaoApreciacao ?? null;
    } else {
      payload.senado_codigo = found.Codigo || found.codigo;
      payload.ementa = found.Ementa || found.ementa || found.DescricaoIdentificacao;
    }

    await addProposicao.mutateAsync(payload);
    handleClose();
  }

  function handleClose() {
    onOpenChange(false);
    setTimeout(() => {
      setCasa("camara");
      setSiglaType("PL");
      setNumero("");
      setAno(new Date().getFullYear().toString());
      setFound(null);
      setNotFound(false);
    }, 200);
  }

  const tipoOptions = casa === "camara" ? TIPOS_CAMARA : TIPOS_SENADO;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar proposição ao monitoramento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-4 pt-1">
          {/* Casa legislativa */}
          <div className="space-y-1.5">
            <Label>Casa legislativa</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setCasa("camara"); setSiglaType("PL"); resetSearch(); }}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  casa === "camara"
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-muted text-muted-foreground"
                }`}
              >
                🏛️ Câmara dos Deputados
              </button>
              <button
                type="button"
                onClick={() => { setCasa("senado"); setSiglaType("PL"); resetSearch(); }}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  casa === "senado"
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-muted text-muted-foreground"
                }`}
              >
                🏛️ Senado Federal
              </button>
            </div>
          </div>

          {/* Tipo / Número / Ano */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={siglaType}
                onValueChange={(v) => { setSiglaType(v); resetSearch(); }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tipoOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Número</Label>
              <Input
                placeholder="ex: 2126"
                value={numero}
                onChange={(e) => { setNumero(e.target.value); resetSearch(); }}
                type="number"
                inputMode="numeric"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input
                placeholder={new Date().getFullYear().toString()}
                value={ano}
                onChange={(e) => { setAno(e.target.value); resetSearch(); }}
                type="number"
                inputMode="numeric"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={searching || !numero || !ano}
          >
            {searching ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando...</>
            ) : (
              <><Search className="h-4 w-4 mr-2" />Buscar na API</>
            )}
          </Button>
        </form>

        {/* Resultado da busca */}
        {notFound && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Proposição não encontrada. Verifique o tipo, número e ano.
          </div>
        )}

        {found && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="font-mono text-xs">
                    {siglaType} {numero}/{ano}
                  </Badge>
                  {casa === "camara" && found.statusProposicao?.descricaoSituacao && (
                    <Badge variant="secondary" className="text-xs">
                      {found.statusProposicao.descricaoSituacao}
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium leading-snug">
                  {found.ementa || found.Ementa || found.DescricaoIdentificacao || "Sem ementa"}
                </p>
                {casa === "camara" && found.statusProposicao?.siglaOrgao && (
                  <p className="text-xs text-muted-foreground">
                    Órgão atual: {found.statusProposicao.siglaOrgao}
                  </p>
                )}
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleAdd}
              disabled={addProposicao.isPending}
            >
              {addProposicao.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adicionando...</>
              ) : (
                "Adicionar ao monitoramento"
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
