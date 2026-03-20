import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderVisit {
  id: string;
  protocolo: string;
  status: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  contact: {
    id: string;
    nome: string;
    telefone_norm: string;
  } | null;
  city: {
    nome: string;
  } | null;
}

export function useLeaderVisits(leaderId: string | undefined) {
  return useQuery({
    queryKey: ["leader_visits", leaderId],
    queryFn: async (): Promise<LeaderVisit[]> => {
      if (!leaderId) return [];

      const { data, error } = await supabase
        .from("office_visits")
        .select(`
          id,
          protocolo,
          status,
          checked_in,
          checked_in_at,
          created_at,
          contact:office_contacts(id, nome, telefone_norm),
          city:office_cities(nome)
        `)
        .eq("leader_id", leaderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!leaderId,
  });
}
