import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface TemaRanking {
  tema: string;
  cadastros: number;
}

export function useTemasRanking() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["temas_ranking", tenantId],
    queryFn: async (): Promise<TemaRanking[]> => {
      let temasQuery = supabase
        .from("temas")
        .select("tema, cadastros")
        .order("cadastros", { ascending: false })
        .limit(20);
      if (tenantId) temasQuery = temasQuery.eq("tenant_id", tenantId);

      let poQuery = supabase
        .from("po_sentiment_analyses")
        .select("topics")
        .gte("analyzed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);
      if (tenantId) poQuery = poQuery.eq("tenant_id", tenantId);

      const [temasRes, poRes] = await Promise.all([temasQuery, poQuery]);

      if (temasRes.error) throw temasRes.error;

      const temasMap = new Map<string, number>();
      (temasRes.data || []).forEach(t => {
        temasMap.set(t.tema.toLowerCase(), t.cadastros);
      });

      if (poRes.data && poRes.data.length > 0) {
        const topicCounts: Record<string, number> = {};
        poRes.data.forEach(row => {
          (row.topics || []).forEach((topic: string) => {
            const key = topic.toLowerCase().trim();
            if (key) topicCounts[key] = (topicCounts[key] || 0) + 1;
          });
        });

        Object.entries(topicCounts).forEach(([topic, count]) => {
          const existing = temasMap.get(topic);
          if (existing !== undefined) {
            temasMap.set(topic, existing + count);
          } else {
            temasMap.set(topic, count);
          }
        });
      }

      const result: TemaRanking[] = Array.from(temasMap.entries())
        .map(([tema, cadastros]) => ({
          tema: tema.charAt(0).toUpperCase() + tema.slice(1),
          cadastros,
        }))
        .sort((a, b) => b.cadastros - a.cadastros)
        .slice(0, 10);

      return result;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!tenantId,
  });
}
