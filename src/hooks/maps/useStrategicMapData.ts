import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderMapData {
  id: string;
  nome_completo: string;
  cadastros: number;
  pontuacao_total: number;
  latitude: number;
  longitude: number;
  cidade_nome: string;
  localidade: string | null;
  is_coordinator: boolean;
  hierarchy_level: number | null;
  parent_leader_id: string | null;
  email: string | null;
  telefone: string | null;
}

export interface ContactMapData {
  id: string;
  nome: string;
  source_type: string | null;
  source_id: string | null;
  latitude: number;
  longitude: number;
  cidade_nome: string;
  localidade: string | null;
}

export interface CityMapData {
  id: string;
  nome: string;
  codigo_ra: string;
  latitude: number;
  longitude: number;
  leaders_count: number;
  contacts_count: number;
}

export function useStrategicMapData() {
  const queryClient = useQueryClient();

  // Realtime subscriptions to auto-update when data changes
  useEffect(() => {
    const leadersChannel = supabase
      .channel('strategic-map-leaders')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lideres' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["strategic_map_leaders"] });
          queryClient.invalidateQueries({ queryKey: ["strategic_map_stats"] });
        }
      )
      .subscribe();

    const contactsChannel = supabase
      .channel('strategic-map-contacts')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'office_contacts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["strategic_map_contacts"] });
          queryClient.invalidateQueries({ queryKey: ["strategic_map_stats"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadersChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [queryClient]);

  // Fetch real totals from database (not filtered by coordinates)
  const statsQuery = useQuery({
    queryKey: ["strategic_map_stats"],
    queryFn: async () => {
      const [coordResult, leadersResult, contactsResult] = await Promise.all([
        supabase.from("lideres").select("id", { count: "exact", head: true })
          .eq("is_active", true).eq("is_coordinator", true),
        supabase.from("lideres").select("id", { count: "exact", head: true })
          .eq("is_active", true).eq("is_coordinator", false),
        supabase.from("office_contacts").select("id", { count: "exact", head: true })
          .eq("is_active", true)
      ]);
      
      return {
        coordinatorsCount: coordResult.count || 0,
        leadersCount: leadersResult.count || 0,
        contactsCount: contactsResult.count || 0
      };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch leaders with city coordinates - always fresh data
  const leadersQuery = useQuery({
    queryKey: ["strategic_map_leaders"],
    queryFn: async (): Promise<LeaderMapData[]> => {
      const { data, error } = await supabase
        .from("lideres")
        .select(`
          id,
          nome_completo,
          cadastros,
          pontuacao_total,
          is_coordinator,
          hierarchy_level,
          parent_leader_id,
          email,
          telefone,
          localidade,
          cidade:office_cities(id, nome, latitude, longitude)
        `)
        .eq("is_active", true);

      if (error) throw error;

      return (data || [])
        .filter((l: any) => l.cidade?.latitude && l.cidade?.longitude)
        .map((l: any) => ({
          id: l.id,
          nome_completo: l.nome_completo,
          cadastros: l.cadastros || 0,
          pontuacao_total: l.pontuacao_total || 0,
          latitude: l.cidade.latitude,
          longitude: l.cidade.longitude,
          cidade_nome: l.cidade.nome,
          localidade: l.localidade || null,
          is_coordinator: l.is_coordinator || false,
          hierarchy_level: l.hierarchy_level,
          parent_leader_id: l.parent_leader_id,
          email: l.email,
          telefone: l.telefone,
        }));
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch contacts with city coordinates and source_id for connections
  // Using pagination to bypass Supabase 1000 row limit
  const contactsQuery = useQuery({
    queryKey: ["strategic_map_contacts"],
    queryFn: async (): Promise<ContactMapData[]> => {
      const allContacts: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from("office_contacts")
          .select(`
            id,
            nome,
            source_type,
            source_id,
            localidade,
            cidade:office_cities(id, nome, latitude, longitude)
          `)
          .eq("is_active", true)
          .range(from, to);

        if (error) throw error;

        if (data && data.length > 0) {
          allContacts.push(...data);
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      console.log("Strategic Map - Total contacts fetched from DB:", allContacts.length);

      const filtered = allContacts
        .filter((c: any) => c.cidade?.latitude && c.cidade?.longitude)
        .map((c: any) => ({
          id: c.id,
          nome: c.nome,
          source_type: c.source_type,
          source_id: c.source_id,
          latitude: c.cidade.latitude,
          longitude: c.cidade.longitude,
          cidade_nome: c.cidade.nome,
        }));

      console.log("Strategic Map - Contacts with valid coordinates:", filtered.length);

      return filtered;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch cities with aggregated counts
  const citiesQuery = useQuery({
    queryKey: ["strategic_map_cities"],
    queryFn: async (): Promise<CityMapData[]> => {
      const { data: cities, error: citiesError } = await supabase
        .from("office_cities")
        .select("id, nome, codigo_ra, latitude, longitude")
        .eq("status", "active");

      if (citiesError) throw citiesError;

      // Get leader counts per city
      const { data: leaderCounts } = await supabase
        .from("lideres")
        .select("cidade_id")
        .eq("is_active", true);

      // Get contact counts per city
      const { data: contactCounts } = await supabase
        .from("office_contacts")
        .select("cidade_id")
        .eq("is_active", true)
        .range(0, 9999);

      const leadersByCity = (leaderCounts || []).reduce((acc: Record<string, number>, l) => {
        if (l.cidade_id) {
          acc[l.cidade_id] = (acc[l.cidade_id] || 0) + 1;
        }
        return acc;
      }, {});

      const contactsByCity = (contactCounts || []).reduce((acc: Record<string, number>, c) => {
        if (c.cidade_id) {
          acc[c.cidade_id] = (acc[c.cidade_id] || 0) + 1;
        }
        return acc;
      }, {});

      return (cities || [])
        .filter((c: any) => c.latitude && c.longitude)
        .map((c: any) => ({
          id: c.id,
          nome: c.nome,
          codigo_ra: c.codigo_ra,
          latitude: c.latitude,
          longitude: c.longitude,
          leaders_count: leadersByCity[c.id] || 0,
          contacts_count: contactsByCity[c.id] || 0,
        }));
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    leaders: leadersQuery.data || [],
    contacts: contactsQuery.data || [],
    cities: citiesQuery.data || [],
    stats: statsQuery.data,
    isLoading: leadersQuery.isLoading || contactsQuery.isLoading || citiesQuery.isLoading || statsQuery.isLoading,
    error: leadersQuery.error || contactsQuery.error || citiesQuery.error || statsQuery.error,
  };
}
