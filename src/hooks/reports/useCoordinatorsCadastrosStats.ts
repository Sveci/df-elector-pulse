import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface CoordinatorCadastroStats {
  id: string;
  nome_completo: string;
  cidade_nome: string | null;
  total_cadastros: number;
  verificados: number;
  pendentes: number;
  taxa_verificacao: number;
}

export function useCoordinatorsCadastrosStats() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["coordinators_cadastros_stats", tenantId],
    queryFn: async (): Promise<CoordinatorCadastroStats[]> => {
      const { data, error } = await supabase.rpc("get_coordinators_cadastros_report", {
        _tenant_id: tenantId || undefined,
      });

      if (error) throw error;

      return (data || []).map((item: {
        id: string;
        nome_completo: string;
        cidade_nome: string | null;
        total_cadastros: number;
        verificados: number;
        pendentes: number;
      }) => ({
        ...item,
        taxa_verificacao: item.total_cadastros > 0 
          ? (item.verificados / item.total_cadastros) * 100 
          : 0,
      }));
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!tenantId,
  });
}
