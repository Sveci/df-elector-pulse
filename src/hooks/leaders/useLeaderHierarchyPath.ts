import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface HierarchyPathNode {
  id: string;
  nome_completo: string;
  hierarchy_level: number | null;
  is_coordinator: boolean;
  parent_leader_id: string | null;
  cidade_nome: string | null;
  telefone: string | null;
  email: string | null;
  depth: number;
}

export function useLeaderHierarchyPath(leaderId: string | undefined) {
  return useQuery({
    queryKey: ["leader-hierarchy-path", leaderId],
    queryFn: async () => {
      if (!leaderId) return [];

      const { data, error } = await supabase.rpc("get_leader_hierarchy_path", {
        _leader_id: leaderId,
      });

      if (error) throw error;
      return (data as HierarchyPathNode[]) || [];
    },
    enabled: !!leaderId,
  });
}
