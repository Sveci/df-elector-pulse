import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportTicket {
  id: string;
  protocolo: string;
  user_id: string;
  assunto: string;
  categoria: string;
  prioridade: string;
  status: string;
  descricao: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  profiles?: {
    name: string;
    email: string;
  } | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  mensagem: string;
  is_admin_response: boolean;
  created_at: string;
}

export function useSupportTickets() {
  return useQuery({
    queryKey: ['support-tickets'],
    queryFn: async () => {
      const { data: tickets, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(tickets.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return tickets.map(ticket => ({
        ...ticket,
        profiles: profilesMap.get(ticket.user_id) || null,
      })) as SupportTicket[];
    },
  });
}

export function useTicketDetails(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-details', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError) throw ticketError;

      // Fetch profile for the ticket owner
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', ticket.user_id)
        .single();

      const { data: messages, error: messagesError } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      return {
        ticket: { ...ticket, profiles: profile } as SupportTicket,
        messages: messages as TicketMessage[],
      };
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      assunto: string;
      categoria: string;
      prioridade: string;
      descricao: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          assunto: data.assunto,
          categoria: data.categoria,
          prioridade: data.prioridade,
          descricao: data.descricao,
        } as any) // protocolo é gerado automaticamente pelo trigger
        .select()
        .single();

      if (error) throw error;
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
  });
}

export function useAddTicketMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      ticket_id: string;
      mensagem: string;
      is_admin_response?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: message, error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: data.ticket_id,
          user_id: user.id,
          mensagem: data.mensagem,
          is_admin_response: data.is_admin_response || false,
        })
        .select()
        .single();

      if (error) throw error;
      return message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-details', variables.ticket_id] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-notifications'] });
    },
  });
}
