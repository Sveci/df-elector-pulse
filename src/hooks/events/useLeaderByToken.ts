import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLeaderByToken(affiliateToken?: string) {
  return useQuery({
    queryKey: ["leader_by_token", affiliateToken],
    queryFn: async () => {
      if (!affiliateToken) return null;

      // Use secure RPC function that returns only needed columns
      // instead of direct table query that exposed all PII
      const { data, error } = await supabase
        .rpc("get_leader_by_affiliate_token", { _token: affiliateToken });

      if (error) throw error;

      // Return first result or null (function returns a table)
      if (!data || data.length === 0) return null;

      // Map to expected format for backwards compatibility
      return {
        id: data[0].id,
        nome_completo: data[0].nome_completo,
        cidade_id: data[0].cidade_id,
        cidade: data[0].cidade_nome ? { nome: data[0].cidade_nome } : null
      };
    },
    enabled: !!affiliateToken
  });
}
