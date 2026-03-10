import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface TopLeader {
  id: string;
  name: string;
  phone: string;
  points: number;
  indicacoes: number;
  region: string;
  position: number;
  active: boolean;
}

export function useTopLeaders() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["top_leaders", tenantId],
    queryFn: async (): Promise<TopLeader[]> => {
      const { data, error } = await supabase
        .rpc("get_top_leaders_with_indicacoes", {
          _limit: 10,
          _tenant_id: tenantId || undefined,
        });

      if (error) throw error;

      return (data || []).map((leader: any, index: number) => ({
        id: leader.id,
        name: leader.nome_completo,
        phone: leader.telefone || "",
        points: leader.pontuacao_total || 0,
        indicacoes: leader.indicacoes || 0,
        region: leader.cidade_nome || "Não informada",
        position: index + 1,
        active: leader.is_active,
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!tenantId,
  });
}
