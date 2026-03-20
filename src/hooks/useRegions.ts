import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OfficeCityType } from "@/types/office";

export function useRegions(tipo?: OfficeCityType) {
  return useQuery({
    queryKey: ['office_cities', tipo],
    queryFn: async () => {
      let query = supabase
        .from('office_cities')
        .select('*')
        .eq('status', 'active')
        .order('nome');

      if (tipo) {
        query = query.eq('tipo', tipo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    }
  });
}
