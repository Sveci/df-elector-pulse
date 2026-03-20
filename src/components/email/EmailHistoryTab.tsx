import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Mail, CheckCircle2, XCircle, Clock, Search, Eye, RefreshCw } from "lucide-react";
import { useEmailLogs, useEmailLogStats, useRetryEmailLog, type EmailLog } from "@/hooks/useEmailLogs";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  sent: { label: "Enviado", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-700", icon: Clock },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700", icon: XCircle },
};

// ─── HTML Preview Dialog ──────────────────────────────────────────────────────
function EmailPreviewDialog({ log, open, onClose }: { log: EmailLog; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold line-clamp-1">
            {log.subject}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Para: {log.to_name ? `${log.to_name} <${log.to_email}>` : log.to_email}
          </p>
        </DialogHeader>
        {log.body_html ? (
          <div
            className="mt-4 border rounded-md overflow-hidden"
            style={{ minHeight: 300 }}
          >
            <iframe
              srcDoc={log.body_html}
              title="Pré-visualização do email"
              className="w-full"
              style={{ minHeight: 480, border: "none" }}
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Conteúdo HTML não disponível para este registro.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Retry Button ─────────────────────────────────────────────────────────────
function RetryButton({ log }: { log: EmailLog }) {
  const retry = useRetryEmailLog();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={retry.isPending || !log.body_html}
          onClick={async () => {
            try {
              await retry.mutateAsync(log);
              toast.success("Email reenviado com sucesso!");
            } catch (err: any) {
              toast.error("Erro ao reenviar: " + err.message);
            }
          }}
        >
          {retry.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{log.body_html ? "Reenviar email" : "HTML não disponível"}</TooltipContent>
    </Tooltip>
  );
}

export function EmailHistoryTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);

  const { data: logs, isLoading } = useEmailLogs({
    status: statusFilter !== "all" ? statusFilter : undefined,
    templateId: templateFilter !== "all" ? templateFilter : undefined,
  });
  const { data: stats } = useEmailLogStats();
  const { data: templates } = useEmailTemplates();

  const filteredLogs = logs?.filter(
    (log) =>
      log.to_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.to_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.failed || 0}</p>
                  <p className="text-xs text-muted-foreground">Falhas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Envios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email, nome ou assunto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sent">Enviados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="failed">Falhas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={templateFilter} onValueChange={setTemplateFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Templates</SelectItem>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLogs && filteredLogs.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-20">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const status = statusConfig[log.status] || statusConfig.pending;
                      const StatusIcon = status.icon;

                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{log.to_name || "-"}</p>
                              <p className="text-sm text-muted-foreground">{log.to_email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {log.subject}
                          </TableCell>
                          <TableCell>
                            {log.email_templates?.nome || "-"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                              {log.error_message && (
                                <p
                                  className="text-xs text-red-500 max-w-[200px] truncate"
                                  title={log.error_message}
                                >
                                  {log.error_message}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {/* Preview button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setPreviewLog(log)}
                                    disabled={!log.body_html}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {log.body_html ? "Visualizar HTML" : "HTML não disponível"}
                                </TooltipContent>
                              </Tooltip>

                              {/* Retry button (only for failed/pending) */}
                              {(log.status === "failed" || log.status === "pending") && (
                                <RetryButton log={log} />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum email encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HTML Preview Dialog */}
        {previewLog && (
          <EmailPreviewDialog
            log={previewLog}
            open={!!previewLog}
            onClose={() => setPreviewLog(null)}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
