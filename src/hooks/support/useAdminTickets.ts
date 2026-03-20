import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SupportTicket } from "./useSupportTickets";

export function useAllTickets() {
  return useQuery({
    queryKey: ['admin-tickets'],
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
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useTicketStats() {
  return useQuery({
    queryKey: ['ticket-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('status');

      if (error) throw error;

      const stats = {
        total: data.length,
        abertos: data.filter(t => t.status === 'aberto').length,
        em_analise: data.filter(t => t.status === 'em_analise').length,
        respondidos: data.filter(t => t.status === 'respondido').length,
        resolvidos: data.filter(t => t.status === 'resolvido').length,
        fechados: data.filter(t => t.status === 'fechado').length,
      };

      return stats;
    },
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      ticketId: string;
      status: string;
    }) => {
      const updateData: Record<string, any> = {
        status: data.status,
        updated_at: new Date().toISOString(),
      };

      if (data.status === 'resolvido') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', data.ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
    },
  });
}
