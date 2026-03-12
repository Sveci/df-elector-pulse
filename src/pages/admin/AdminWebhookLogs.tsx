import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Webhook, Loader2, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WebhookLog {
  id: string;
  source: string;
  method: string | null;
  content_type: string | null;
  headers: Record<string, string> | null;
  raw_payload: Record<string, unknown> | null;
  user_agent: string | null;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  processing_result: string | null;
  contact_id: string | null;
  leader_id: string | null;
  created_at: string;
}

const resultLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  contact_created: { label: "Contato Criado", variant: "default" },
  contact_updated: { label: "Contato Atualizado", variant: "secondary" },
  leader_updated: { label: "Líder Atualizado", variant: "outline" },
};

// Campos que não devem ser exibidos nos detalhes colapsáveis
const HIDDEN_FIELDS = ["timestamp", "user_agent"];

// Labels amigáveis para os campos do payload
const fieldLabels: Record<string, string> = {
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  cpf: "CPF",
  evento: "Evento",
  origem: "Origem (URL)",
  categoria: "Categoria",
  municipio: "Município",
  data_evento: "Data do Evento",
  data_inscricao: "Data da Inscrição",
  cidade: "Cidade",
  data_nascimento: "Data de Nascimento",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_campaign: "UTM Campaign",
  utm_content: "UTM Content",
  url: "URL da Página",
};

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  const str = String(value);
  
  if (key === "data_inscricao" && str.includes("T")) {
    try {
      return format(new Date(str), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    } catch { return str; }
  }
  if (key === "data_evento") {
    try {
      const [y, m, d] = str.split("-");
      return `${d}/${m}/${y}`;
    } catch { return str; }
  }
  return str;
}

function isUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

const AdminWebhookLogs = () => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-webhook-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as WebhookLog[];
    },
  });

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getVisibleFields = (payload: Record<string, unknown> | null) => {
    if (!payload) return [];
    return Object.entries(payload)
      .filter(([key]) => !HIDDEN_FIELDS.includes(key))
      .map(([key, value]) => ({
        key,
        label: fieldLabels[key] || key,
        value,
      }));
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Webhook className="h-6 w-6 text-primary" />
              Logs de Webhook
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {logs.length} registros — Payloads brutos recebidos antes do processamento
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Webhook className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum log de webhook encontrado</p>
              <p className="text-xs mt-1">Os próximos envios serão registrados aqui</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const result = resultLabels[log.processing_result || ""] || { label: log.processing_result || "Pendente", variant: "outline" as const };
              const payloadName = log.raw_payload?.nome || log.raw_payload?.name || "—";
              const payloadPhone = log.raw_payload?.telefone || log.raw_payload?.phone || log.raw_payload?.whatsapp || "—";
              const payloadOrigem = log.raw_payload?.origem;
              const isExpanded = expandedIds.has(log.id);
              const visibleFields = getVisibleFields(log.raw_payload);

              return (
                <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleExpand(log.id)}>
                  <Card className="transition-colors hover:border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate">
                              {String(payloadName)}
                            </span>
                            <Badge variant={result.variant} className="text-[10px] px-1.5 shrink-0">
                              {result.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            📞 {String(payloadPhone)}
                          </p>
                          {payloadOrigem && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <a
                                href={String(payloadOrigem)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {String(payloadOrigem)}
                              </a>
                            </p>
                          )}
                        </div>
                        <div className="flex items-start gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(log.created_at), "HH:mm:ss")}
                            </p>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>

                      <CollapsibleContent>
                        <div className="mt-4 pt-3 border-t border-border">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                            Dados recebidos ({visibleFields.length} campos)
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                            {visibleFields.map(({ key, label, value }) => (
                              <div key={key} className="flex flex-col py-1">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                {isUrl(value) ? (
                                  <a
                                    href={String(value)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-primary hover:underline break-all"
                                  >
                                    {String(value)}
                                  </a>
                                ) : (
                                  <span className="text-sm text-foreground break-all">
                                    {formatFieldValue(key, value)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminWebhookLogs;
