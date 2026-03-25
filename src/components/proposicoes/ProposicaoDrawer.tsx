import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ExternalLink,
  Users,
  FileText,
  Bell,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { TramitacoesTimeline } from "./TramitacoesTimeline";
import {
  useTramitacoesCached,
  useTramitacoesCamara,
  useAutoresProposicaoCamara,
  useNotificacoesLog,
} from "@/hooks/proposicoes/useProposicaoDetalhe";
import {
  ProposicaoMonitorada,
  getGrupoSituacao,
  getSituacaoColor,
  getSituacaoLabel,
} from "@/hooks/proposicoes/useProposicoesMonitoradas";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProposicaoDrawerProps {
  proposicao: ProposicaoMonitorada | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProposicaoDrawer({
  proposicao,
  open,
  onOpenChange,
}: ProposicaoDrawerProps) {
  const [tab, setTab] = useState("tramitacoes");

  // Dados cached (histórico do banco)
  const { data: tramitacoesCached, isLoading: loadingCached } =
    useTramitacoesCached(open && proposicao ? proposicao.id : null);

  // Tramitações live da API da Câmara
  const { data: tramitacoesLive, isLoading: loadingLive, refetch: refetchLive } =
    useTramitacoesCamara(
      open && proposicao?.casa === "camara" ? proposicao.camara_id : null
    );

  // Autores
  const { data: autores, isLoading: loadingAutores } = useAutoresProposicaoCamara(
    open && proposicao?.casa === "camara" ? proposicao.camara_id : null
  );

  // Log de notificações
  const { data: notifLog, isLoading: loadingNotif } = useNotificacoesLog(
    open && proposicao ? proposicao.id : null
  );

  if (!proposicao) return null;

  const grupo = getGrupoSituacao(proposicao.cod_situacao);
  const novasTramitacoes = tramitacoesCached?.filter((t) => !t.notificado_em && t.eh_evento_critico).length ?? 0;

  // Map live tramitações to TramitacaoItem shape for the timeline
  const liveItems = (tramitacoesLive || []).map((t: any, i: number) => ({
    id: `live-${i}`,
    sequencia: t.sequencia,
    data_hora: t.dataHora,
    sigla_orgao: t.siglaOrgao,
    cod_tipo_tramitacao: t.codTipoTramitacao,
    descricao_tramitacao: t.descricaoTramitacao,
    cod_situacao: t.codSituacao,
    descricao_situacao: t.descricaoSituacao,
    despacho: t.despacho,
    url_documento: t.url,
    regime: t.regime,
    eh_evento_critico: [231, 244, 197, 196, 320, 128, 251, 502, 1012, 1013, 620, 198, 200, 219, 227].includes(t.codTipoTramitacao),
    grupo_situacao: null,
    notificado_em: null,
    created_at: new Date().toISOString(),
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col gap-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  {proposicao.sigla_tipo} {proposicao.numero}/{proposicao.ano}
                </Badge>
                <Badge className={getSituacaoColor(grupo)}>
                  {getSituacaoLabel(grupo)}
                </Badge>
                {novasTramitacoes > 0 && (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                    🔔 {novasTramitacoes} novo{novasTramitacoes > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-base leading-snug mt-2">
                {proposicao.ementa || "Sem ementa"}
              </SheetTitle>
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {proposicao.sigla_orgao_situacao && (
              <span>Órgão: <strong className="text-foreground">{proposicao.sigla_orgao_situacao}</strong></span>
            )}
            {proposicao.descricao_situacao && (
              <span className="col-span-2">
                Situação: <strong className="text-foreground">{proposicao.descricao_situacao}</strong>
              </span>
            )}
            {proposicao.data_situacao && (
              <span>
                Última movimentação:{" "}
                <strong className="text-foreground">
                  {format(new Date(proposicao.data_situacao), "dd/MM/yyyy", { locale: ptBR })}
                </strong>
              </span>
            )}
            {proposicao.ultima_verificacao_em && (
              <span>
                Verificado:{" "}
                <strong className="text-foreground">
                  {format(new Date(proposicao.ultima_verificacao_em), "dd/MM HH:mm", { locale: ptBR })}
                </strong>
              </span>
            )}
            {proposicao.autor_nome && (
              <span className="col-span-2">
                Autor: <strong className="text-foreground">{proposicao.autor_nome}</strong>
                {proposicao.autor_partido && ` – ${proposicao.autor_partido}`}
                {proposicao.autor_uf && `/${proposicao.autor_uf}`}
              </span>
            )}
          </div>

          {/* Links */}
          <div className="flex items-center gap-2 flex-wrap">
            {proposicao.url_inteiro_teor && (
              <a
                href={proposicao.url_inteiro_teor}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  Inteiro teor
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            )}
            {proposicao.camara_id && (
              <a
                href={`https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${proposicao.camara_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Câmara.leg.br
                </Button>
              </a>
            )}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b bg-transparent h-10 shrink-0 px-6">
            <TabsTrigger value="tramitacoes" className="flex-1 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Tramitações
            </TabsTrigger>
            <TabsTrigger value="live" className="flex-1 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Ao vivo (API)
            </TabsTrigger>
            <TabsTrigger value="autores" className="flex-1 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              Autores
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="flex-1 text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Bell className="h-3.5 w-3.5 mr-1" />
              Notificações
            </TabsTrigger>
          </TabsList>

          {/* Tramitações do banco */}
          <TabsContent value="tramitacoes" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full px-6 py-4">
              <TramitacoesTimeline
                tramitacoes={tramitacoesCached || []}
                isLoading={loadingCached}
                emptyMessage="Nenhuma tramitação registrada. Execute o monitoramento."
              />
            </ScrollArea>
          </TabsContent>

          {/* Tramitações live da API */}
          <TabsContent value="live" className="flex-1 overflow-hidden mt-0">
            <div className="flex items-center justify-between px-6 py-3 border-b">
              <p className="text-xs text-muted-foreground">
                Dados direto da API da Câmara (últimas 50)
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => refetchLive()}
                disabled={loadingLive}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLive ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
            <ScrollArea className="h-[calc(100%-48px)] px-6 py-4">
              <TramitacoesTimeline
                tramitacoes={liveItems}
                isLoading={loadingLive}
                emptyMessage="Nenhuma tramitação encontrada na API."
              />
            </ScrollArea>
          </TabsContent>

          {/* Autores */}
          <TabsContent value="autores" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full px-6 py-4">
              {loadingAutores ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando autores...
                </div>
              ) : !autores || autores.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground text-sm">
                  <Users className="h-8 w-8 opacity-40" />
                  <p>Nenhum autor encontrado</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {autores.map((autor: any, i: number) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                        {(autor.nome || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{autor.nome}</p>
                        {(autor.siglaPartido || autor.siglaUf) && (
                          <p className="text-xs text-muted-foreground">
                            {[autor.siglaPartido, autor.siglaUf].filter(Boolean).join(" – ")}
                          </p>
                        )}
                        {autor.tipo && (
                          <p className="text-xs text-muted-foreground">{autor.tipo}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Log de notificações */}
          <TabsContent value="notificacoes" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full px-6 py-4">
              {loadingNotif ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : !notifLog || notifLog.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 opacity-40" />
                  <p>Nenhuma notificação enviada</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {notifLog.map((log: any) => (
                    <li key={log.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant={log.status === "sent" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {log.status === "sent" ? "Enviado" : "Falhou"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.enviado_em), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      {log.proposicoes_alertas_config?.nome && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Alerta: {log.proposicoes_alertas_config.nome}
                        </p>
                      )}
                      {log.provider_usado && (
                        <p className="text-xs text-muted-foreground">
                          Via: {log.provider_usado === "zapi" ? "Z-API" : "Meta Cloud"}
                        </p>
                      )}
                      {log.mensagem_enviada && (
                        <>
                          <Separator className="my-2" />
                          <p className="text-xs whitespace-pre-wrap text-foreground/70 line-clamp-4">
                            {log.mensagem_enviada}
                          </p>
                        </>
                      )}
                      {log.erro && (
                        <p className="text-xs text-destructive mt-1">{log.erro}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
