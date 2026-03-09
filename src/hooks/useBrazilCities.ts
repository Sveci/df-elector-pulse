import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CityOption {
  value: string;
  label: string;
}

/**
 * Fetches cities for a given UF.
 * Strategy: DB first, then IBGE API as fallback (and sync to DB via edge function).
 */
export function useBrazilCities(uf: string | undefined) {
  return useQuery({
    queryKey: ["brazil_cities", uf],
    queryFn: async (): Promise<CityOption[]> => {
      if (!uf) return [];
      const upperUf = uf.toUpperCase();

      // 1. Try DB first
      const { data: dbCities, error } = await supabase
        .from("ibge_cidades")
        .select("nome")
        .eq("uf", upperUf)
        .order("nome");

      if (!error && dbCities && dbCities.length > 0) {
        return dbCities.map((c) => ({ value: c.nome, label: c.nome }));
      }

      // 2. DB empty — trigger sync via edge function (fire & forget won't block)
      // Meanwhile fetch from IBGE API directly
      const syncPromise = supabase.functions.invoke("sync-ibge-data", {
        body: { uf: upperUf },
      });

      const res = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
      );
      if (!res.ok) {
        // Wait for sync to complete as last resort
        await syncPromise;
        // Re-query DB
        const { data: retryDb } = await supabase
          .from("ibge_cidades")
          .select("nome")
          .eq("uf", upperUf)
          .order("nome");
        if (retryDb && retryDb.length > 0) {
          return retryDb.map((c) => ({ value: c.nome, label: c.nome }));
        }
        throw new Error("Erro ao buscar cidades");
      }

      const apiCities: { id: number; nome: string }[] = await res.json();
      // Wait for sync to complete in background
      syncPromise.catch(() => {});

      return apiCities.map((c) => ({ value: c.nome, label: c.nome }));
    },
    enabled: !!uf,
    staleTime: 1000 * 60 * 60,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

/**
 * Fetches districts for a given UF + city.
 * Strategy: DB first, then IBGE API as fallback (and sync to DB via edge function).
 */
export function useBrazilDistricts(
  uf: string | undefined,
  cityName: string | undefined
) {
  return useQuery({
    queryKey: ["brazil_districts", uf, cityName],
    queryFn: async (): Promise<CityOption[]> => {
      if (!uf || !cityName) return [];
      const upperUf = uf.toUpperCase();

      // 1. Find city IBGE ID from DB
      const { data: cityRow } = await supabase
        .from("ibge_cidades")
        .select("ibge_id")
        .eq("uf", upperUf)
        .ilike("nome", cityName)
        .limit(1)
        .maybeSingle();

      if (cityRow) {
        // Check DB for cached districts
        const { data: dbDistricts } = await supabase
          .from("ibge_distritos")
          .select("nome")
          .eq("cidade_ibge_id", cityRow.ibge_id)
          .order("nome");

        if (dbDistricts && dbDistricts.length > 0) {
          return dbDistricts.map((d) => ({ value: d.nome, label: d.nome }));
        }
      }

      // 2. Trigger sync and fetch from IBGE API
      const syncPromise = supabase.functions.invoke("sync-ibge-data", {
        body: { uf: upperUf, include_districts: true, cidade_nome: cityName },
      });

      // Direct IBGE fetch as fallback
      const citiesRes = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`
      );
      if (!citiesRes.ok) {
        await syncPromise;
        // Re-query DB after sync
        if (cityRow) {
          const { data: retryDb } = await supabase
            .from("ibge_distritos")
            .select("nome")
            .eq("cidade_ibge_id", cityRow.ibge_id)
            .order("nome");
          if (retryDb && retryDb.length > 0) {
            return retryDb.map((d) => ({ value: d.nome, label: d.nome }));
          }
        }
        return [];
      }

      const cities: { id: number; nome: string }[] = await citiesRes.json();
      const city = cities.find(
        (c) => c.nome.toLowerCase() === cityName.toLowerCase()
      );
      if (!city) return [];

      const distRes = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${city.id}/distritos?orderBy=nome`
      );
      if (!distRes.ok) return [];

      const districts: { id: number; nome: string }[] = await distRes.json();
      syncPromise.catch(() => {});

      return districts.map((d) => ({ value: d.nome, label: d.nome }));
    },
    enabled: !!uf && !!cityName,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  });
}
