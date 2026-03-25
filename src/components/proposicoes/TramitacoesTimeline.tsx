import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, AlertTriangle, CheckCircle2, XCircle, Clock, FileText } from "lucide-react";
import { TramitacaoItem } from "@/hooks/proposicoes/useProposicaoDetalhe";
import { cn } from "@/lib/utils";

interface TramitacoesTimelineProps {
  tramitacoes: TramitacaoItem[];
  isLoading?: boolean;
  emptyMessage?: string;
}

function getGrupoIcon(grupo: string | null) {
  switch (grupo) {
    case "aprovada":  return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "arquivada": return <XCircle className="h-4 w-4 text-red-600" />;
    case "atencao":   return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default:          return <Clock className="h-4 w-4 text-blue-600" />;
  }
}

function getGrupoColor(grupo: string | null): string {
  switch (grupo) {
    case "aprovada":  return "border-green-400 bg-green-50";
    case "arquivada": return "border-red-400 bg-red-50";
    case "atencao":   return "border-yellow-400 bg-yellow-50";
    default:          return "border-blue-300 bg-white";
  }
}

function getGrupoDotColor(grupo: string | null): string {
  switch (grupo) {
    case "aprovada":  return "bg-green-500";
    case "arquivada": return "bg-red-500";
    case "atencao":   return "bg-yellow-500";
    default:          return "bg-blue-400";
  }
}

export function TramitacoesTimeline({
  tramitacoes,
  isLoading,
  emptyMessage = "Nenhuma tramitação registrada ainda.",
}: TramitacoesTimelineProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Carregando tramitações...
      </div>
    );
  }

  if (!tramitacoes || tramitacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <FileText className="h-8 w-8 opacity-40" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ol className="relative border-l-2 border-muted ml-3 space-y-0">
      {tramitacoes.map((tram, index) => {
        const dataHora = new Date(tram.data_hora);
        const isFirst = index === 0;

        return (
          <li key={tram.id} className="mb-4 ml-6">
            {/* Dot on the timeline */}
            <span
              className={cn(
                "absolute -left-[9px] flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-background",
                tram.eh_evento_critico
                  ? getGrupoDotColor(tram.grupo_situacao)
                  : "bg-muted-foreground/40"
              )}
            />

            <div
              className={cn(
                "rounded-lg border p-3 text-sm transition-all",
                tram.eh_evento_critico
                  ? getGrupoColor(tram.grupo_situacao)
                  : "border-muted bg-muted/20",
                isFirst && "ring-1 ring-primary/20"
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {tram.eh_evento_critico && getGrupoIcon(tram.grupo_situacao)}
                  <span className={cn("font-medium", tram.eh_evento_critico ? "text-foreground" : "text-muted-foreground")}>
                    {tram.descricao_tramitacao || "Tramitação"}
                  </span>
                  {tram.eh_evento_critico && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                      Crítico
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {tram.sigla_orgao && (
                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                      {tram.sigla_orgao}
                    </Badge>
                  )}
                  {tram.notificado_em ? (
                    <Bell className="h-3.5 w-3.5 text-green-600" />
                  ) : tram.eh_evento_critico ? (
                    <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : null}
                </div>
              </div>

              {/* Data */}
              <time className="block text-xs text-muted-foreground mt-1">
                {format(dataHora, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                {tram.sequencia ? ` · seq. ${tram.sequencia}` : ""}
              </time>

              {/* Situação */}
              {tram.descricao_situacao && (
                <p className="text-xs text-muted-foreground mt-1">
                  Situação: <span className="font-medium">{tram.descricao_situacao}</span>
                </p>
              )}

              {/* Despacho */}
              {tram.despacho && (
                <p className="text-xs mt-1.5 leading-relaxed text-foreground/80 line-clamp-3">
                  {tram.despacho}
                </p>
              )}

              {/* Regime */}
              {tram.regime && (
                <p className="text-xs text-muted-foreground mt-1">
                  Regime: {tram.regime}
                </p>
              )}

              {/* Link para documento */}
              {tram.url_documento && (
                <a
                  href={tram.url_documento}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                >
                  <FileText className="h-3 w-3" />
                  Ver documento
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
