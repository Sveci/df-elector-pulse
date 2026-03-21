import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TopComment {
  id: string;
  author: string;
  source: string;
  content: string;
  sentiment: string;
  sentiment_score: number;
  category: string;
  date: string;
  url: string;
}

async function fetchTopComments(
  entityId: string,
  order: "asc" | "desc",
  limit: number
): Promise<TopComment[]> {
  // Get analyses sorted by sentiment_score
  const { data: analyses, error: aErr } = await supabase
    .from("po_sentiment_analyses")
    .select("mention_id, sentiment, sentiment_score, category")
    .eq("entity_id", entityId)
    .not("sentiment_score", "is", null)
    .order("sentiment_score", { ascending: order === "asc" })
    .limit(limit);

  if (aErr) throw aErr;
  if (!analyses || analyses.length === 0) return [];

  const mentionIds = analyses.map((a) => a.mention_id);
  const { data: mentions, error: mErr } = await supabase
    .from("po_mentions")
    .select("id, author_name, author_handle, source, content, published_at, collected_at, source_url")
    .in("id", mentionIds);

  if (mErr) throw mErr;

  const mentionMap = new Map((mentions || []).map((m) => [m.id, m]));

  return analyses
    .filter((a) => mentionMap.has(a.mention_id))
    .map((a) => {
      const m = mentionMap.get(a.mention_id)!;
      return {
        id: m.id,
        author: m.author_name || m.author_handle || "Anônimo",
        source: m.source,
        content: m.content,
        sentiment: a.sentiment,
        sentiment_score: a.sentiment_score ?? 0,
        category: a.category || "sem categoria",
        date: m.published_at || m.collected_at,
        url: m.source_url || "#",
      };
    });
}

export function useTopHeavyComments(entityId?: string, limit = 15) {
  return useQuery({
    queryKey: ["po_top_heavy", entityId, limit],
    enabled: !!entityId,
    queryFn: () => fetchTopComments(entityId!, "asc", limit),
  });
}

export function useTopPraiseComments(entityId?: string, limit = 15) {
  return useQuery({
    queryKey: ["po_top_praise", entityId, limit],
    enabled: !!entityId,
    queryFn: () => fetchTopComments(entityId!, "desc", limit),
  });
}
