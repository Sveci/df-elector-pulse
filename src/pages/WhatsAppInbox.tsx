import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, Search, Send, User, Phone, MapPin, Calendar, Mail, Clock, ArrowDown, Check, CheckCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { formatPhoneToBR } from "@/utils/phoneNormalizer";
import {
  useInboxConversations,
  useConversationMessages,
  useSendInboxMessage,
  useInboxContactDetails,
  type InboxConversation,
  type InboxMessage,
} from "@/hooks/useWhatsAppInbox";

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

function formatFullTime(dateStr: string) {
  return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

function MessageStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "read": return <CheckCheck className="h-3.5 w-3.5 text-blue-500" />;
    case "delivered": return <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />;
    case "sent": return <Check className="h-3.5 w-3.5 text-muted-foreground" />;
    case "failed": return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
    default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

// ── Conversations List ────────────────────────────────────────────────────────

function ConversationsList({
  conversations,
  selectedPhone,
  onSelect,
  searchTerm,
  onSearchChange,
}: {
  conversations: InboxConversation[];
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
  searchTerm: string;
  onSearchChange: (v: string) => void;
}) {
  const filtered = conversations.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.phone.includes(term) ||
      (c.contactName?.toLowerCase().includes(term) ?? false) ||
      c.lastMessage.toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-80 min-w-[320px] border-r flex flex-col h-full bg-background overflow-hidden">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.phone}
              onClick={() => onSelect(conv.phone)}
              className={cn(
                "w-full text-left p-3 hover:bg-muted/50 transition-colors border-b border-border/50 flex gap-3",
                selectedPhone === conv.phone && "bg-muted"
              )}
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate">
                    {conv.contactName || formatPhoneToBR(conv.phone)}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-1">
                    {formatMessageTime(conv.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate pr-2">
                    {conv.lastDirection === "outgoing" && "Você: "}
                    {conv.lastMessage.slice(0, 60)}
                  </p>
                  {conv.unreadCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 text-[10px] px-1.5 flex-shrink-0">
                      {conv.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

// ── Chat Panel ────────────────────────────────────────────────────────────────

function ChatPanel({ phone }: { phone: string }) {
  const { data: messages = [], isLoading } = useConversationMessages(phone);
  const sendMessage = useSendInboxMessage();
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = newMessage.trim();
    if (!text) return;
    setNewMessage("");
    sendMessage.mutate(
      { phone, message: text },
      {
        onError: () => toast.error("Erro ao enviar mensagem"),
      }
    );
  }, [newMessage, phone, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages: { date: string; messages: InboxMessage[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const d = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (d !== currentDate) {
      currentDate = d;
      groupedMessages.push({ date: d, messages: [] });
    }
    groupedMessages[groupedMessages.length - 1].messages.push(msg);
  }

  function formatDateLabel(dateStr: string) {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 bg-muted/20">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma mensagem encontrada
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[11px] bg-muted px-3 py-1 rounded-full text-muted-foreground">
                  {formatDateLabel(group.date)}
                </span>
              </div>
              {group.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex mb-1.5",
                    msg.direction === "outgoing" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-xl px-3 py-2 text-sm shadow-sm break-words",
                      msg.direction === "outgoing"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card text-card-foreground border rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <div className={cn(
                      "flex items-center justify-end gap-1 mt-0.5",
                      msg.direction === "outgoing" ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      <span className="text-[10px]">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                      {msg.direction === "outgoing" && <MessageStatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 bg-background">
        <div className="flex gap-2 items-end">
          <Textarea
            placeholder="Digite uma mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="resize-none min-h-[40px] max-h-[120px]"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!newMessage.trim() || sendMessage.isPending}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Enter para enviar · Shift+Enter para nova linha
        </p>
      </div>
    </div>
  );
}

// ── Contact Details Panel ─────────────────────────────────────────────────────

function ContactPanel({ phone }: { phone: string }) {
  const { data: contact, isLoading } = useInboxContactDetails(phone);

  return (
    <div className="w-72 min-w-[288px] border-l bg-background flex flex-col overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-sm font-semibold">Detalhes do Contato</h3>
      </div>
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !contact ? (
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{formatPhoneToBR(phone)}</p>
            <p className="text-xs text-muted-foreground">Contato não cadastrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <User className="h-8 w-8 text-primary" />
              </div>
              <p className="font-semibold mt-2">{contact.nome}</p>
              <p className="text-xs text-muted-foreground">{formatPhoneToBR(contact.telefone_norm)}</p>
            </div>

            <Separator />

            <div className="space-y-3 text-sm">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              {(contact.office_cities?.nome || contact.localidade) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{contact.office_cities?.nome || contact.localidade}</span>
                </div>
              )}
              {contact.data_nascimento && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{format(new Date(contact.data_nascimento), "dd/MM/yyyy")}</span>
                </div>
              )}
              {contact.genero && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="capitalize">{contact.genero}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>Desde {format(new Date(contact.created_at), "dd/MM/yyyy")}</span>
              </div>
            </div>

            {contact.observacao && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Observação</p>
                  <p className="text-sm">{contact.observacao}</p>
                </div>
              </>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ── Exported Inbox Content (embeddable, no DashboardLayout) ──────────────────

export function WhatsAppInboxContent() {
  const { data: conversations = [], isLoading } = useInboxConversations();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <div className="flex h-[calc(100vh-280px)] min-h-[400px] border rounded-lg overflow-hidden relative">
      <ConversationsList
        conversations={conversations}
        selectedPhone={selectedPhone}
        onSelect={setSelectedPhone}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {selectedPhone ? (
        <>
          <ChatPanel phone={selectedPhone} />
          <ContactPanel phone={selectedPhone} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-5xl">💬</div>
            <h3 className="font-semibold text-lg">Selecione uma conversa</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Escolha uma conversa no painel à esquerda para visualizar as mensagens e responder em tempo real.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppInboxContent;
