import { useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Webhook, Loader2, RefreshCw, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const AdminWebhookLogs = () => {
  const [selected, setSelected] = useState<WebhookLog | null>(null);

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
              const payloadEmail = log.raw_payload?.email || "—";

              return (
                <Card
                  key={log.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setSelected(log)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {String(payloadName)}
                          </span>
                          <Badge variant={result.variant} className="text-[10px] px-1.5 shrink-0">
                            {result.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          📞 {String(payloadPhone)} · ✉️ {String(payloadEmail)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Object.keys(log.raw_payload || {}).length} campos recebidos
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="text-lg">Payload Bruto do Webhook</DialogTitle>
            </DialogHeader>
            {selected && (
              <ScrollArea className="max-h-[65vh]">
                <div className="space-y-4 pr-4">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Data:</span>
                      <p className="font-medium text-foreground">
                        {format(new Date(selected.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Resultado:</span>
                      <p className="font-medium text-foreground">
                        {resultLabels[selected.processing_result || ""]?.label || selected.processing_result || "Pendente"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Content-Type:</span>
                      <p className="font-medium text-foreground text-xs break-all">{selected.content_type || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Método:</span>
                      <p className="font-medium text-foreground">{selected.method || "—"}</p>
                    </div>
                  </div>

                  {/* Raw Payload */}
                  <div>
                    <span className="text-sm font-semibold text-foreground">Payload Recebido (dados brutos)</span>
                    <pre className="mt-1 text-xs text-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-lg overflow-x-auto font-mono">
                      {JSON.stringify(selected.raw_payload, null, 2)}
                    </pre>
                  </div>

                  {/* Headers */}
                  {selected.headers && Object.keys(selected.headers).length > 0 && (
                    <div>
                      <span className="text-sm font-semibold text-foreground">Headers</span>
                      <pre className="mt-1 text-xs text-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-lg overflow-x-auto font-mono">
                        {JSON.stringify(selected.headers, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* User Agent */}
                  {selected.user_agent && (
                    <div>
                      <span className="text-sm text-muted-foreground">User Agent:</span>
                      <p className="text-xs text-foreground break-all">{selected.user_agent}</p>
                    </div>
                  )}

                  {/* Response */}
                  {selected.response_body && (
                    <div>
                      <span className="text-sm font-semibold text-foreground">Resposta do Processamento</span>
                      <pre className="mt-1 text-xs text-foreground whitespace-pre-wrap bg-muted/50 p-4 rounded-lg overflow-x-auto font-mono">
                        {JSON.stringify(selected.response_body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminWebhookLogs;
