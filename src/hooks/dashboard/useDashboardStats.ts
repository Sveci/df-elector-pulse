import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

interface DashboardStats {
  totalRegistrations: number;
  citiesReached: number;
  activeLeaders: number;
  topCity: string;
  topCityCount: number;
  lastRegistration: string | null;
}

export function useDashboardStats() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["dashboard_stats", tenantId],
    queryFn: async (): Promise<DashboardStats> => {
      // Total de contatos
      let contactsQuery = supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true });
      if (tenantId) contactsQuery = contactsQuery.eq("tenant_id", tenantId);
      const { count: totalContacts } = await contactsQuery;

      // Total de líderes
      let leadersQuery = supabase
        .from("lideres")
        .select("*", { count: "exact", head: true });
      if (tenantId) leadersQuery = leadersQuery.eq("tenant_id", tenantId);
      const { count: totalLeaders } = await leadersQuery;

      const totalRegistrations = (totalContacts || 0) + (totalLeaders || 0);

      // Cidades alcançadas via RPC
      const { data: citiesCount } = await (supabase.rpc as any)("get_distinct_cities_count", {
        _tenant_id: tenantId || undefined,
      });
      const citiesReached = Number(citiesCount) || 0;

      // Líderes ativos
      let activeQuery = supabase
        .from("lideres")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (tenantId) activeQuery = activeQuery.eq("tenant_id", tenantId);
      const { count: activeLeaders } = await activeQuery;

      // Cidade top via RPC
      const { data: topCityData } = await supabase.rpc("get_top_city", {
        _tenant_id: tenantId || undefined,
      });
      const topCity = topCityData?.[0]?.city_name || "N/A";
      const topCityCount = topCityData?.[0]?.city_count || 0;

      // Último cadastro
      let lastQuery = supabase
        .from("office_contacts")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      if (tenantId) lastQuery = lastQuery.eq("tenant_id", tenantId);
      const { data: lastContact } = await lastQuery.single();

      return {
        totalRegistrations: totalRegistrations || 0,
        citiesReached,
        activeLeaders: activeLeaders || 0,
        topCity,
        topCityCount,
        lastRegistration: lastContact?.created_at || null,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!tenantId,
  });
}
