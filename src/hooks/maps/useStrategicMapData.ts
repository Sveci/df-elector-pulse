import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocalidadeGeocoding } from "./useLocalidadeGeocoding";
import { useOrganization } from "@/hooks/useOrganization";
import { getLocationFieldType } from "@/constants/brazilPolitics";

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
  const { data: organization } = useOrganization();

  const cargo = organization?.cargo || null;
  const estado = organization?.estado || null;
  const fieldType = getLocationFieldType(cargo);
  const useOfficeCities = fieldType === 'ra';

  // Geocoding for localidade-based mode
  const geocoding = useLocalidadeGeocoding(!useOfficeCities ? estado : null);

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
    queryKey: ["strategic_map_leaders", useOfficeCities, geocoding.isReady],
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
        .map((l: any) => {
          // Mode 1: office_cities (RA mode) - use cidade coordinates
          if (l.cidade?.latitude && l.cidade?.longitude) {
            return {
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
            };
          }

          // Mode 2: localidade geocoding - resolve from IBGE
          if (!useOfficeCities && l.localidade && geocoding.isReady) {
            const coords = geocoding.lookup(l.localidade);
            if (coords) {
              return {
                id: l.id,
                nome_completo: l.nome_completo,
                cadastros: l.cadastros || 0,
                pontuacao_total: l.pontuacao_total || 0,
                latitude: coords.lat,
                longitude: coords.lng,
                cidade_nome: l.localidade,
                localidade: l.localidade,
                is_coordinator: l.is_coordinator || false,
                hierarchy_level: l.hierarchy_level,
                parent_leader_id: l.parent_leader_id,
                email: l.email,
                telefone: l.telefone,
              };
            }
          }

          return null;
        })
        .filter((l): l is LeaderMapData => l !== null);
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Fetch contacts with city coordinates and source_id for connections
  // Using pagination to bypass Supabase 1000 row limit
  const contactsQuery = useQuery({
    queryKey: ["strategic_map_contacts", useOfficeCities, geocoding.isReady],
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
        .map((c: any) => {
          // Mode 1: office_cities
          if (c.cidade?.latitude && c.cidade?.longitude) {
            return {
              id: c.id,
              nome: c.nome,
              source_type: c.source_type,
              source_id: c.source_id,
              latitude: c.cidade.latitude,
              longitude: c.cidade.longitude,
              cidade_nome: c.cidade.nome,
              localidade: c.localidade || null,
            };
          }

          // Mode 2: localidade geocoding
          if (!useOfficeCities && c.localidade && geocoding.isReady) {
            const coords = geocoding.lookup(c.localidade);
            if (coords) {
              return {
                id: c.id,
                nome: c.nome,
                source_type: c.source_type,
                source_id: c.source_id,
                latitude: coords.lat,
                longitude: coords.lng,
                cidade_nome: c.localidade,
                localidade: c.localidade,
              };
            }
          }

          return null;
        })
        .filter((c): c is ContactMapData => c !== null);

      console.log("Strategic Map - Contacts with valid coordinates:", filtered.length);

      return filtered;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch cities with aggregated counts (only in RA mode)
  const citiesQuery = useQuery({
    queryKey: ["strategic_map_cities", useOfficeCities, geocoding.isReady],
    queryFn: async (): Promise<CityMapData[]> => {
      if (useOfficeCities) {
        // RA mode: use office_cities table
        const { data: cities, error: citiesError } = await supabase
          .from("office_cities")
          .select("id, nome, codigo_ra, latitude, longitude")
          .eq("status", "active");

        if (citiesError) throw citiesError;

        const { data: leaderCounts } = await supabase
          .from("lideres")
          .select("cidade_id")
          .eq("is_active", true);

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
      }

      // Localidade mode: build virtual cities from localidade + geocoding
      if (!geocoding.isReady) return [];

      // Get unique localidades from leaders and contacts
      const [{ data: leaderLocs }, { data: contactLocs }] = await Promise.all([
        supabase.from("lideres").select("localidade").eq("is_active", true),
        supabase.from("office_contacts").select("localidade").eq("is_active", true).range(0, 9999),
      ]);

      const localidadeCounts = new Map<string, { leaders: number; contacts: number }>();

      for (const l of leaderLocs || []) {
        if (l.localidade) {
          const key = l.localidade;
          const entry = localidadeCounts.get(key) || { leaders: 0, contacts: 0 };
          entry.leaders++;
          localidadeCounts.set(key, entry);
        }
      }

      for (const c of contactLocs || []) {
        if (c.localidade) {
          const key = c.localidade;
          const entry = localidadeCounts.get(key) || { leaders: 0, contacts: 0 };
          entry.contacts++;
          localidadeCounts.set(key, entry);
        }
      }

      const virtualCities: CityMapData[] = [];
      for (const [localidade, counts] of localidadeCounts) {
        const coords = geocoding.lookup(localidade);
        if (coords) {
          virtualCities.push({
            id: localidade, // use localidade as virtual ID
            nome: localidade,
            codigo_ra: "",
            latitude: coords.lat,
            longitude: coords.lng,
            leaders_count: counts.leaders,
            contacts_count: counts.contacts,
          });
        }
      }

      return virtualCities;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    leaders: leadersQuery.data || [],
    contacts: contactsQuery.data || [],
    cities: citiesQuery.data || [],
    stats: statsQuery.data,
    isLoading: leadersQuery.isLoading || contactsQuery.isLoading || citiesQuery.isLoading || statsQuery.isLoading || geocoding.isLoading,
    error: leadersQuery.error || contactsQuery.error || citiesQuery.error,
  };
}
