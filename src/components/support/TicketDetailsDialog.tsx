import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTicketDetails, useAddTicketMessage } from "@/hooks/support/useSupportTickets";
import { useUpdateTicketStatus } from "@/hooks/support/useAdminTickets";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { TicketPriorityBadge } from "./TicketPriorityBadge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send, User, UserCog, XCircle } from "lucide-react";

interface TicketDetailsDialogProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin?: boolean;
}

export function TicketDetailsDialog({ ticketId, open, onOpenChange, isAdmin = false }: TicketDetailsDialogProps) {
  const [newMessage, setNewMessage] = useState("");
  const { data, isLoading } = useTicketDetails(ticketId);
  const addMessage = useAddTicketMessage();
  const updateStatus = useUpdateTicketStatus();

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !ticketId) return;

    try {
      await addMessage.mutateAsync({
        ticket_id: ticketId,
        mensagem: newMessage,
        is_admin_response: isAdmin,
      });

      // Se é admin e o ticket não está resolvido/fechado, marcar como respondido
      if (isAdmin && data?.ticket.status !== 'resolvido' && data?.ticket.status !== 'fechado' && data?.ticket.status !== 'respondido') {
        await updateStatus.mutateAsync({ ticketId, status: 'respondido' });
      }

      setNewMessage("");
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi adicionada ao ticket.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar a mensagem.",
        variant: "destructive",
      });
    }
  };

  const handleCloseTicket = async () => {
    if (!ticketId) return;

    try {
      await updateStatus.mutateAsync({ ticketId, status: 'fechado' });
      toast({
        title: "Ticket encerrado",
        description: "O ticket foi encerrado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível encerrar o ticket.",
        variant: "destructive",
      });
    }
  };

  if (!ticketId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes do Ticket</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Ticket Info */}
            <div className="border rounded-lg p-4 mb-4 bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {data.ticket.protocolo}
                </span>
                <div className="flex gap-2">
                  <TicketPriorityBadge prioridade={data.ticket.prioridade} />
                  <TicketStatusBadge status={data.ticket.status} />
                </div>
              </div>
              <h3 className="font-semibold mb-2">{data.ticket.assunto}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {data.ticket.descricao}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Aberto por:</span>{" "}
                {data.ticket.profiles?.name || "Usuário desconhecido"}
                <span className="mx-1">•</span>
                Criado em {format(new Date(data.ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0">
              <h4 className="text-sm font-medium mb-2">Mensagens</h4>
              <ScrollArea className="h-[250px] border rounded-lg p-3">
                {data.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mensagem ainda.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${msg.is_admin_response ? 'flex-row-reverse' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          msg.is_admin_response
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {msg.is_admin_response ? (
                            <UserCog className="h-4 w-4" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </div>
                        <div className={`flex-1 max-w-[80%] ${msg.is_admin_response ? 'text-right' : ''}`}>
                          <div className={`inline-block rounded-lg px-3 py-2 text-sm ${
                            msg.is_admin_response
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.mensagem}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* New Message */}
            {data.ticket.status !== 'fechado' && data.ticket.status !== 'resolvido' && (
              <div className="mt-4 flex gap-2">
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={2}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || addMessage.isPending}
                  size="icon"
                  className="h-auto"
                >
                  {addMessage.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}

            {/* Admin Close Ticket Button */}
            {isAdmin && data.ticket.status !== 'fechado' && (
              <div className="mt-4 pt-4 border-t flex justify-end">
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={handleCloseTicket}
                  disabled={updateStatus.isPending}
                >
                  {updateStatus.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Encerrar Ticket
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
