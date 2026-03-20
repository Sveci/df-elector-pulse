import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Clock,
  History,
  Phone,
  RefreshCw,
  Send,
  Timer,
  User,
  XCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useResendSMS } from "@/hooks/sms/useResendSMS";
import type { RetryHistoryEntry } from "@/hooks/useSMSMessages";

interface SMSMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  status: string;
  error_message?: string | null;
  message_id?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  retry_count?: number;
  max_retries?: number;
  next_retry_at?: string | null;
  retry_history?: RetryHistoryEntry[];
  contact?: {
    id: string;
    nome: string;
  } | null;
}

interface SMSDetailsDialogProps {
  message: SMSMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300 bg-blue-50">
          <Clock className="h-3 w-3" />
          Na fila
        </Badge>
      );
    case "sent":
      return (
        <Badge variant="outline" className="gap-1 text-green-600 border-green-300 bg-green-50">
          <Send className="h-3 w-3" />
          Enviado
        </Badge>
      );
    case "delivered":
      return (
        <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300 bg-emerald-50">
          <CheckCircle className="h-3 w-3" />
          Entregue
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Falhou
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Pendente
        </Badge>
      );
  }
}

export function SMSDetailsDialog({ message, open, onOpenChange }: SMSDetailsDialogProps) {
  const { resend, isResending } = useResendSMS();

  if (!message) return null;

  const handleResend = async () => {
    await resend({
      phone: message.phone,
      message: message.message,
      contactId: message.contact?.id,
    });
    onOpenChange(false);
  };

  const canResend = message.status === "failed" && message.direction === "outgoing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {message.direction === "outgoing" ? (
              <ArrowUpRight className="h-5 w-5 text-blue-500" />
            ) : (
              <ArrowDownLeft className="h-5 w-5 text-green-500" />
            )}
            Detalhes do SMS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge status={message.status} />
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{formatPhone(message.phone)}</p>
                <p className="text-xs text-muted-foreground">Telefone</p>
              </div>
            </div>

            {message.contact?.nome && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{message.contact.nome}</p>
                  <p className="text-xs text-muted-foreground">Contato</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Message */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Mensagem</p>
            <div className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
              {message.message}
            </div>
          </div>

          {/* Error Message */}
          {message.error_message && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erro no envio</AlertTitle>
              <AlertDescription className="text-sm">
                {message.error_message}
              </AlertDescription>
            </Alert>
          )}

          {/* Retry Info */}
          {message.status === "failed" && message.retry_count !== undefined && message.retry_count > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Tentativas de Reenvio
                  </span>
                  <Badge variant="outline">
                    {message.retry_count}/{message.max_retries || 6}
                  </Badge>
                </div>

                {message.next_retry_at && new Date(message.next_retry_at) > new Date() && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                    <Timer className="h-4 w-4" />
                    <span>
                      Próxima tentativa {formatDistanceToNow(new Date(message.next_retry_at), {
                        addSuffix: true,
                        locale: ptBR
                      })}
                    </span>
                  </div>
                )}

                {message.retry_count >= (message.max_retries || 6) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Máximo de tentativas atingido. Use o botão abaixo para reenviar manualmente.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}

          {/* Retry History */}
          {message.retry_history && message.retry_history.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4" />
                  Histórico de Tentativas
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {message.retry_history.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-xs bg-muted p-2 rounded"
                    >
                      <div className="flex items-center gap-2">
                        {entry.status === "delivered" ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <XCircle className="h-3 w-3 text-destructive" />
                        )}
                        <span>Tentativa {entry.attempt + 1}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {format(new Date(entry.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Timestamps */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Criado em</span>
              <span>
                {format(new Date(message.created_at), "dd/MM/yyyy 'às' HH:mm", {
                  locale: ptBR,
                })}
              </span>
            </div>

            {message.sent_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enviado em</span>
                <span>
                  {format(new Date(message.sent_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
            )}

            {message.delivered_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entregue em</span>
                <span>
                  {format(new Date(message.delivered_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
            )}

            {message.message_id && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID da Mensagem</span>
                <span className="font-mono text-xs">{message.message_id}</span>
              </div>
            )}
          </div>

          {/* Resend Button */}
          {canResend && (
            <>
              <Separator />
              <Button
                onClick={handleResend}
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reenviando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reenviar SMS
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
