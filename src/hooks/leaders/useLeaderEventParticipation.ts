import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderEventRegistration {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  event: {
    id: string;
    name: string;
    slug: string;
    date: string;
    time: string;
    location: string;
    address: string | null;
    categories: string[];
  } | null;
}

export interface LeaderIndicatedEventRegistration {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
  event: {
    id: string;
    name: string;
    slug: string;
    date: string;
    time: string;
    location: string;
  } | null;
}

export function useLeaderEventParticipation(leaderId: string | undefined, leaderPhone: string | undefined, leaderEmail: string | undefined) {
  // Eventos que o líder indicou pessoas
  const indicatedQuery = useQuery({
    queryKey: ["leader_indicated_events", leaderId],
    queryFn: async (): Promise<LeaderIndicatedEventRegistration[]> => {
      if (!leaderId) return [];

      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          id,
          nome,
          email,
          whatsapp,
          checked_in,
          checked_in_at,
          created_at,
          event:events(id, name, slug, date, time, location)
        `)
        .eq("leader_id", leaderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!leaderId,
  });

  // Eventos que o próprio líder se inscreveu (por telefone ou email)
  const ownQuery = useQuery({
    queryKey: ["leader_own_events", leaderPhone, leaderEmail],
    queryFn: async (): Promise<LeaderEventRegistration[]> => {
      if (!leaderPhone && !leaderEmail) return [];

      // Normalizar telefone para busca
      const normalizedPhone = leaderPhone?.replace(/\D/g, '') || '';

      let query = supabase
        .from("event_registrations")
        .select(`
          id,
          nome,
          email,
          whatsapp,
          checked_in,
          checked_in_at,
          created_at,
          event:events(id, name, slug, date, time, location, address, categories)
        `)
        .order("created_at", { ascending: false });

      // Buscar por email ou whatsapp (sem o leader_id para não duplicar)
      if (leaderEmail) {
        query = query.eq("email", leaderEmail);
      } else if (normalizedPhone) {
        query = query.ilike("whatsapp", `%${normalizedPhone.slice(-8)}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!(leaderPhone || leaderEmail),
  });

  return {
    indicatedEvents: indicatedQuery.data || [],
    ownEvents: ownQuery.data || [],
    isLoading: indicatedQuery.isLoading || ownQuery.isLoading,
  };
}
