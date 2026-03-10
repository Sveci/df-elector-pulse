import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface CityRanking {
  name: string;
  value: number;
}

export function useCitiesRanking() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["cities_ranking", tenantId],
    queryFn: async (): Promise<CityRanking[]> => {
      const { data, error } = await (supabase.rpc as any)("get_cities_ranking", {
        _tenant_id: tenantId || undefined,
      });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        name: row.city_name,
        value: Number(row.city_count),
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!tenantId,
  });
}
