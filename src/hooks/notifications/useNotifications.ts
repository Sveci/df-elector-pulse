import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export interface SystemNotification {
  id: string;
  titulo: string;
  descricao: string;
  tipo: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface TicketNotification {
  id: string;
  ticket_id: string;
  mensagem: string;
  created_at: string;
  ticket_protocolo: string;
  ticket_assunto: string;
}

export function useUnreadCount() {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['notifications-unread-count', isSuperAdmin],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { tickets: 0, updates: 0, adminTickets: 0 };

      // Get all ticket messages that are admin responses to user's tickets
      const { data: ticketMessages, error: ticketError } = await supabase
        .from('support_ticket_messages')
        .select(`
          id,
          ticket_id,
          support_tickets!inner (user_id)
        `)
        .eq('is_admin_response', true)
        .eq('support_tickets.user_id', user.id);

      if (ticketError) throw ticketError;

      // Get read ticket messages
      const { data: readTickets, error: readTicketError } = await supabase
        .from('user_notification_reads')
        .select('ticket_message_id')
        .eq('user_id', user.id)
        .not('ticket_message_id', 'is', null);

      if (readTicketError) throw readTicketError;

      const readTicketIds = new Set(readTickets?.map(r => r.ticket_message_id) || []);
      const unreadTickets = ticketMessages?.filter(m => !readTicketIds.has(m.id)).length || 0;

      // Count admin unread (user responses to tickets) - only for super admins
      let adminUnreadTickets = 0;
      if (isSuperAdmin) {
        const { data: userMessages, error: userMsgError } = await supabase
          .from('support_ticket_messages')
          .select('id')
          .eq('is_admin_response', false);

        if (!userMsgError && userMessages) {
          const unreadAdminMessages = userMessages.filter(m => !readTicketIds.has(m.id));
          adminUnreadTickets = unreadAdminMessages.length;
        }
      }

      // Get all active system notifications
      const { data: notifications, error: notifError } = await supabase
        .from('system_notifications')
        .select('id')
        .eq('is_active', true);

      if (notifError) throw notifError;

      // Get read system notifications
      const { data: readNotifs, error: readNotifError } = await supabase
        .from('user_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .not('notification_id', 'is', null);

      if (readNotifError) throw readNotifError;

      const readNotifIds = new Set(readNotifs?.map(r => r.notification_id) || []);
      const unreadUpdates = notifications?.filter(n => !readNotifIds.has(n.id)).length || 0;

      return {
        tickets: unreadTickets,
        updates: unreadUpdates,
        adminTickets: adminUnreadTickets,
      };
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useTicketNotifications() {
  return useQuery({
    queryKey: ['ticket-notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: messages, error } = await supabase
        .from('support_ticket_messages')
        .select(`
          id,
          ticket_id,
          mensagem,
          created_at,
          support_tickets!inner (
            user_id,
            protocolo,
            assunto
          )
        `)
        .eq('is_admin_response', true)
        .eq('support_tickets.user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get read status
      const { data: reads } = await supabase
        .from('user_notification_reads')
        .select('ticket_message_id')
        .eq('user_id', user.id);

      const readIds = new Set(reads?.map(r => r.ticket_message_id) || []);

      return messages?.map(m => ({
        id: m.id,
        ticket_id: m.ticket_id,
        mensagem: m.mensagem,
        created_at: m.created_at,
        ticket_protocolo: (m.support_tickets as any).protocolo,
        ticket_assunto: (m.support_tickets as any).assunto,
        is_read: readIds.has(m.id),
      })) || [];
    },
  });
}

export function useSystemNotifications() {
  return useQuery({
    queryKey: ['system-notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: notifications, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get read status
      const { data: reads } = await supabase
        .from('user_notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      const readIds = new Set(reads?.map(r => r.notification_id) || []);

      return notifications?.map(n => ({
        ...n,
        is_read: readIds.has(n.id),
      })) || [];
    },
  });
}

// Hook para notificações de admin - respostas de usuários aos tickets
export function useAdminTicketNotifications() {
  const { data: isSuperAdmin } = useIsSuperAdmin();

  return useQuery({
    queryKey: ['admin-ticket-notifications'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Buscar mensagens de usuários (não são respostas de admin)
      const { data: messages, error } = await supabase
        .from('support_ticket_messages')
        .select(`
          id,
          ticket_id,
          mensagem,
          created_at,
          user_id,
          support_tickets!inner (
            protocolo,
            assunto
          )
        `)
        .eq('is_admin_response', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Get read status
      const { data: reads } = await supabase
        .from('user_notification_reads')
        .select('ticket_message_id')
        .eq('user_id', user.id);

      const readIds = new Set(reads?.map(r => r.ticket_message_id) || []);

      return messages?.map(m => ({
        id: m.id,
        ticket_id: m.ticket_id,
        mensagem: m.mensagem,
        created_at: m.created_at,
        ticket_protocolo: (m.support_tickets as any).protocolo,
        ticket_assunto: (m.support_tickets as any).assunto,
        is_read: readIds.has(m.id),
      })) || [];
    },
    enabled: !!isSuperAdmin,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: 'ticket' | 'notification';
      id: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const insertData: Record<string, any> = {
        user_id: user.id,
      };

      if (data.type === 'ticket') {
        insertData.ticket_message_id = data.id;
      } else {
        insertData.notification_id = data.id;
      }

      const { error } = await supabase
        .from('user_notification_reads')
        .upsert([insertData as any], {
          onConflict: data.type === 'ticket' ? 'user_id,ticket_message_id' : 'user_id,notification_id',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: 'tickets' | 'notifications' | 'all') => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      if (type === 'tickets' || type === 'all') {
        // Get all unread ticket messages
        const { data: messages } = await supabase
          .from('support_ticket_messages')
          .select('id, support_tickets!inner(user_id)')
          .eq('is_admin_response', true)
          .eq('support_tickets.user_id', user.id);

        if (messages && messages.length > 0) {
          for (const m of messages) {
            await supabase
              .from('user_notification_reads')
              .upsert({
                user_id: user.id,
                ticket_message_id: m.id,
              }, { onConflict: 'user_id,ticket_message_id' });
          }
        }
      }

      if (type === 'notifications' || type === 'all') {
        // Get all active notifications
        const { data: notifications } = await supabase
          .from('system_notifications')
          .select('id')
          .eq('is_active', true);

        if (notifications && notifications.length > 0) {
          for (const n of notifications) {
            await supabase
              .from('user_notification_reads')
              .upsert({
                user_id: user.id,
                notification_id: n.id,
              }, { onConflict: 'user_id,notification_id' });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['system-notifications'] });
    },
  });
}
