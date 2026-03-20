import { memo } from "react";
import { Bell, MessageCircle, Info, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useUnreadCount, useTicketNotifications, useSystemNotifications, useMarkAsRead, useMarkAllAsRead, useAdminTicketNotifications } from "@/hooks/notifications/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export const NotificationBell = memo(function NotificationBell() {
  const navigate = useNavigate();
  const { data: isSuperAdmin } = useIsSuperAdmin();
  const { data: unreadCount } = useUnreadCount();
  const { data: ticketNotifications } = useTicketNotifications();
  const { data: adminTicketNotifications } = useAdminTicketNotifications();
  const { data: systemNotifications } = useSystemNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  // Para admin: mostra notificações de respostas de usuários
  // Para usuários: mostra notificações de respostas de admin
  const displayedTicketNotifications = isSuperAdmin ? adminTicketNotifications : ticketNotifications;
  const ticketUnreadCount = isSuperAdmin ? unreadCount?.adminTickets : unreadCount?.tickets;

  const totalUnread = (ticketUnreadCount || 0) + (unreadCount?.updates || 0);

  const handleTicketClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead.mutate({ type: 'ticket', id: notification.id });
    }
    // Navegar com ticket_id como query param
    if (isSuperAdmin) {
      navigate(`/settings/admin-tickets?ticket=${notification.ticket_id}`);
    } else {
      navigate(`/settings/support?ticket=${notification.ticket_id}`);
    }
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead.mutate({ type: 'notification', id: notification.id });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative mr-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {totalUnread > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
            >
              {totalUnread > 99 ? '99+' : totalUnread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Tabs defaultValue="tickets" className="w-full">
          <div className="border-b px-3 py-2 flex items-center justify-between">
            <h4 className="font-semibold text-sm">Notificações</h4>
            {totalUnread > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllAsRead.mutate('all')}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>

          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="tickets" className="text-xs relative">
              Tickets
              {ticketUnreadCount ? (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {ticketUnreadCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="updates" className="text-xs relative">
              Atualizações
              {unreadCount?.updates ? (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {unreadCount.updates}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tickets" className="m-0">
            <ScrollArea className="h-[300px]">
              {displayedTicketNotifications && displayedTicketNotifications.length > 0 ? (
                <div className="divide-y">
                  {displayedTicketNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!notif.is_read ? 'bg-primary/5' : ''}`}
                      onClick={() => handleTicketClick(notif)}
                    >
                      <div className="flex items-start gap-2">
                        <MessageCircle className={`h-4 w-4 mt-0.5 ${!notif.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {notif.ticket_protocolo}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {notif.ticket_assunto}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notif.mensagem}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma resposta de ticket</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="updates" className="m-0">
            <ScrollArea className="h-[300px]">
              {systemNotifications && systemNotifications.length > 0 ? (
                <div className="divide-y">
                  {systemNotifications.map((notif) => (
                    <button
                      key={notif.id}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${!notif.is_read ? 'bg-primary/5' : ''}`}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <div className="flex items-start gap-2">
                        <Info className={`h-4 w-4 mt-0.5 ${!notif.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">
                            {notif.titulo}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notif.descricao}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        {!notif.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
                  <Info className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma atualização</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
});
