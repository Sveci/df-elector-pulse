import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/contexts/TenantContext";

export interface BrainMetric {
  id: string;
  tenant_id: string;
  periodo: string;
  total_mensagens: number;
  resolvidas_por_flow: number;
  resolvidas_por_cache: number;
  resolvidas_por_kb: number;
  resolvidas_por_ia: number;
  clarificacoes: number;
  tokens_gastos: number;
  tokens_economizados: number;
}

export interface BrainCacheStats {
  total_entries: number;
  avg_reuse: number;
  top_categories: { categoria: string; count: number }[];
}

export function useBrainMetrics() {
  const { activeTenant } = useTenantContext();
  return useQuery({
    queryKey: ["brain-metrics", activeTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brain_metrics")
        .select("*")
        .eq("tenant_id", activeTenant!.id)
        .order("periodo", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as unknown as BrainMetric[];
    },
    enabled: !!activeTenant?.id,
    staleTime: 1000 * 60 * 5,
  });
}

export function useBrainCacheStats() {
  const { activeTenant } = useTenantContext();
  return useQuery({
    queryKey: ["brain-cache-stats", activeTenant?.id],
    queryFn: async () => {
      // Get total entries and avg reuse
      const { data: cacheData, error } = await supabase
        .from("brain_cache")
        .select("id, vezes_utilizada, categoria")
        .eq("tenant_id", activeTenant!.id)
        .eq("ativo", true);
      if (error) throw error;

      const entries = cacheData || [];
      const totalEntries = entries.length;
      const avgReuse = totalEntries > 0
        ? entries.reduce((sum: number, e: any) => sum + (e.vezes_utilizada || 0), 0) / totalEntries
        : 0;

      // Count categories
      const catMap = new Map<string, number>();
      entries.forEach((e: any) => {
        const cat = e.categoria || "geral";
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      });
      const topCategories = Array.from(catMap.entries())
        .map(([categoria, count]) => ({ categoria, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return { total_entries: totalEntries, avg_reuse: avgReuse, top_categories: topCategories } as BrainCacheStats;
    },
    enabled: !!activeTenant?.id,
    staleTime: 1000 * 60 * 5,
  });
}
