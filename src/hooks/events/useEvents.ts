import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export function useEvents() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["events", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select("*, coordinator:lideres!events_created_by_coordinator_id_fkey(id, nome_completo)")
        .order("date", { ascending: false });
      
      if (tenantId) query = query.eq("tenant_id", tenantId);
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
}

export function useEvent(slug: string) {
  return useQuery({
    queryKey: ["event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug
  });
}
