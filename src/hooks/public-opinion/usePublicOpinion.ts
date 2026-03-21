import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──
export interface MonitoredEntity {
  id: string;
  nome: string;
  tipo: string;
  partido: string | null;
  cargo: string | null;
  redes_sociais: Record<string, string>;
  hashtags: string[];
  palavras_chave: string[];
  is_principal: boolean;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

export interface Mention {
  id: string;
  entity_id: string;
  source: string;
  source_url: string | null;
  author_name: string | null;
  author_handle: string | null;
  content: string;
  published_at: string | null;
  collected_at: string;
  engagement: Record<string, number>;
  hashtags: string[];
}

export interface SentimentAnalysis {
  id: string;
  mention_id: string;
  entity_id: string;
  sentiment: string;
  sentiment_score: number | null;
  category: string | null;
  subcategory: string | null;
  topics: string[];
  emotions: string[];
  is_about_adversary: boolean;
  adversary_entity_id: string | null;
  confidence: number | null;
  ai_summary: string | null;
  analyzed_at: string;
}

export interface DailySnapshot {
  id: string;
  entity_id: string;
  snapshot_date: string;
  total_mentions: number;
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  avg_sentiment_score: number;
  top_topics: string[];
  top_emotions: string[];
  source_breakdown: Record<string, number>;
}

export interface PoEvent {
  id: string;
  entity_id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  tipo: string;
  impacto_score: number | null;
  total_mentions: number;
  sentiment_positivo_pct: number;
  sentiment_negativo_pct: number;
  sentiment_neutro_pct: number;
  ai_analysis: string | null;
  tags: string[];
}

// ── Entities ──
export function useMonitoredEntities() {
  return useQuery({
    queryKey: ["po_monitored_entities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_monitored_entities")
        .select("*")
        .eq("is_active", true)
        .order("is_principal", { ascending: false });
      if (error) throw error;
      return data as MonitoredEntity[];
    },
  });
}

export function useCreateEntity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entity: Partial<MonitoredEntity>) => {
      const { data, error } = await supabase
        .from("po_monitored_entities")
        .insert([entity as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_monitored_entities"] });
      toast.success("Entidade cadastrada com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Mentions ──
export function useMentions(entityId?: string, source?: string, limit = 50) {
  return useQuery({
    queryKey: ["po_mentions", entityId, source, limit],
    enabled: !!entityId,
    queryFn: async () => {
      let q = supabase
        .from("po_mentions")
        .select("*")
        .eq("entity_id", entityId!)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (source) q = q.eq("source", source);
      const { data, error } = await q;
      if (error) throw error;
      return data as Mention[];
    },
  });
}

// ── Sentiment Analyses ──
export function useSentimentAnalyses(entityId?: string, days = 30) {
  return useQuery({
    queryKey: ["po_sentiment_analyses", entityId, days],
    enabled: !!entityId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      // Paginate past 1000 limit
      let all: SentimentAnalysis[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("po_sentiment_analyses")
          .select("*")
          .eq("entity_id", entityId!)
          .gte("analyzed_at", since.toISOString())
          .order("analyzed_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all = all.concat(data as SentimentAnalysis[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });
}

// ── Pending Mentions Count ──
export function usePendingMentionsCount(entityId?: string) {
  return useQuery({
    queryKey: ["po_pending_mentions_count", entityId],
    enabled: !!entityId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count: totalMentions, error: e1 } = await supabase
        .from("po_mentions")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", entityId!);
      if (e1) throw e1;

      const { count: totalAnalyses, error: e2 } = await supabase
        .from("po_sentiment_analyses")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", entityId!);
      if (e2) throw e2;

      return Math.max(0, (totalMentions || 0) - (totalAnalyses || 0));
    },
  });
}

// ── Daily Snapshots ──
export function useDailySnapshots(entityId?: string, days = 30) {
  return useQuery({
    queryKey: ["po_daily_snapshots", entityId, days],
    enabled: !!entityId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchOnMount: true,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const sinceStr = since.toISOString().split("T")[0];
      const todayStr = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("po_daily_snapshots")
        .select("*")
        .eq("entity_id", entityId!)
        .gte("snapshot_date", sinceStr)
        .lte("snapshot_date", todayStr)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data as DailySnapshot[];
    },
  });
}

// ── Events ──
export function usePoEvents(entityId?: string) {
  return useQuery({
    queryKey: ["po_events", entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_events")
        .select("*")
        .eq("entity_id", entityId!)
        .eq("is_active", true)
        .order("data_evento", { ascending: false });
      if (error) throw error;
      return data as PoEvent[];
    },
  });
}

export function useCreatePoEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: Partial<PoEvent>) => {
      const { data, error } = await supabase
        .from("po_events")
        .insert([event as any])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_events"] });
      toast.success("Evento registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Collection ──
export function useCollectMentions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { entity_id: string; sources?: string[]; query?: string }) => {
      const { data, error } = await supabase.functions.invoke("po-collect-mentions", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; background?: boolean; job_id?: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["po_mentions"] });
      qc.invalidateQueries({ queryKey: ["po_sentiment_analyses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Insights ──
export function useGenerateInsights() {
  return useMutation({
    mutationFn: async (params: { entity_id: string; period_days?: number }) => {
      const { data, error } = await supabase.functions.invoke("po-generate-insights", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Analyze Pending ──
export function useAnalyzePending() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { entity_id: string }) => {
      const { data, error } = await supabase.functions.invoke("analyze-sentiment", {
        body: { entity_id: params.entity_id, analyze_pending: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["po_sentiment_analyses"] });
      qc.invalidateQueries({ queryKey: ["po_mentions"] });
      qc.invalidateQueries({ queryKey: ["po_pending_mentions_count"] });
      if (data?.background) {
        toast.success(`Processando ${data.total_mentions ?? 0} menções em segundo plano. Os dados serão atualizados automaticamente.`);
      } else {
        toast.success(`${data.analyzed ?? 0} menções analisadas com sucesso`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ── Relevance filter ──
const IRRELEVANT_KEYWORDS = [
  "irrelevante", "sem relação", "sem cunho político", "não se refere",
  "não está relacionad", "sem conexão", "não menciona", "sem relevância",
  "não é sobre", "sem vínculo", "conteúdo genérico",
];

function isRelevantAnalysis(a: SentimentAnalysis): boolean {
  // Exclude analyses the AI flagged as irrelevant
  if (a.ai_summary) {
    const lower = a.ai_summary.toLowerCase();
    if (IRRELEVANT_KEYWORDS.some(kw => lower.includes(kw))) return false;
  }
  // Exclude humor/entertainment with zero score (typically unrelated content)
  if (a.category === "humor" && (a.sentiment_score === 0 || a.sentiment_score === null)) return false;
  return true;
}

// ── Stats helpers ──
export function usePoOverviewStats(entityId?: string) {
  const { data: analyses, isLoading: isLoadingAnalyses } = useSentimentAnalyses(entityId, 30);
  const { data: snapshots, isLoading: isLoadingSnapshots } = useDailySnapshots(entityId, 30);
  const { data: mentions, isLoading: isLoadingMentions } = useMentions(entityId, undefined, 1000);

  const isLoading = isLoadingAnalyses || isLoadingSnapshots || isLoadingMentions;

  // Filter out irrelevant analyses
  const relevantAnalyses = analyses?.filter(isRelevantAnalysis);

  // Build a set of relevant mention IDs for source breakdown filtering
  const relevantMentionIds = new Set(relevantAnalyses?.map(a => a.mention_id) || []);

  const relevantMentions = mentions?.filter(m => relevantMentionIds.has(m.id)) || [];

  const sourceBreakdown = relevantMentions.length
    ? Object.entries(
        relevantMentions.reduce<Record<string, number>>((acc, m) => {
          acc[m.source] = (acc[m.source] || 0) + 1;
          return acc;
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({ name, value: count }))
    : [];

  // Calculate real engagement from mention engagement fields
  const totalEngagement = relevantMentions.reduce((sum, m) => {
    const eng = m.engagement as Record<string, number> | null;
    if (!eng) return sum;
    return sum + Object.values(eng).reduce((s, v) => s + (Number(v) || 0), 0);
  }, 0);

  // Estimated reach: sum engagement × average multiplier, or fallback to mention count × 50
  const estimatedReach = totalEngagement > 0
    ? totalEngagement * 8 // avg 8 impressions per interaction
    : relevantMentions.length * 50;

  const stats = relevantAnalyses?.length ? {
    total: relevantAnalyses.length,
    positive: relevantAnalyses.filter(a => a.sentiment === "positivo").length,
    negative: relevantAnalyses.filter(a => a.sentiment === "negativo").length,
    neutral: relevantAnalyses.filter(a => a.sentiment === "neutro").length,
    avgScore: relevantAnalyses.reduce((s, a) => s + (a.sentiment_score || 0), 0) / relevantAnalyses.length,
    topTopics: getTopItems(relevantAnalyses.flatMap(a => a.topics || []), 5),
    topEmotions: getTopItems(relevantAnalyses.flatMap(a => a.emotions || []), 5),
    topCategories: getTopItems(relevantAnalyses.map(a => a.category).filter(Boolean) as string[], 5),
    totalEngagement,
    estimatedReach,
  } : null;

  return { stats, snapshots, analyses: relevantAnalyses, sourceBreakdown, isLoading };
}

function getTopItems(items: string[], limit: number) {
  const counts: Record<string, number> = {};
  items.forEach(i => counts[i] = (counts[i] || 0) + 1);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
