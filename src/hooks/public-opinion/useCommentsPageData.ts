import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UseCommentsPageDataParams {
  entityId?: string;
  source?: string;
  sentiment?: string; // 'positivo' | 'negativo' | 'neutro'
  category?: string;
  search?: string;
  page: number;
  pageSize: number;
}

interface CommentItem {
  id: string;
  author: string;
  source: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  category: string;
  date: string;
  likes: number;
  shares: number;
  url: string;
}

interface CommentsPageResult {
  items: CommentItem[];
  totalCount: number;
}

export function useCommentsPageData(params: UseCommentsPageDataParams) {
  const { entityId, source, sentiment, category, search, page, pageSize } = params;

  return useQuery({
    queryKey: ["po_comments_page", entityId, source, sentiment, category, search, page, pageSize],
    enabled: !!entityId,
    queryFn: async (): Promise<CommentsPageResult> => {
      // Strategy: join mentions with analyses server-side via two queries
      // 1. Get filtered analyses count + page
      // 2. For unfiltered sentiment: also include unanalyzed mentions

      const from = page * pageSize;
      const to = from + pageSize - 1;

      if (sentiment || category) {
        // When filtering by sentiment or category, we MUST go through analyses
        let countQuery = supabase
          .from("po_sentiment_analyses")
          .select("id", { count: "exact", head: true })
          .eq("entity_id", entityId!);

        let dataQuery = supabase
          .from("po_sentiment_analyses")
          .select("id, mention_id, sentiment, category, sentiment_score")
          .eq("entity_id", entityId!)
          .order("analyzed_at", { ascending: false })
          .range(from, to);

        if (sentiment) {
          countQuery = countQuery.eq("sentiment", sentiment);
          dataQuery = dataQuery.eq("sentiment", sentiment);
        }
        if (category) {
          // Handle accent variations
          const categoryVariants = getCategoryVariants(category);
          if (categoryVariants.length === 1) {
            countQuery = countQuery.eq("category", categoryVariants[0]);
            dataQuery = dataQuery.eq("category", categoryVariants[0]);
          } else {
            countQuery = countQuery.in("category", categoryVariants);
            dataQuery = dataQuery.in("category", categoryVariants);
          }
        }

        const [{ count }, { data: analyses, error: aErr }] = await Promise.all([
          countQuery,
          dataQuery,
        ]);

        if (aErr) throw aErr;
        if (!analyses || analyses.length === 0) return { items: [], totalCount: count || 0 };

        // Fetch the corresponding mentions
        const mentionIds = analyses.map(a => a.mention_id);
        let mentionQuery = supabase
          .from("po_mentions")
          .select("*")
          .in("id", mentionIds);

        if (source) mentionQuery = mentionQuery.eq("source", source);
        if (search) mentionQuery = mentionQuery.ilike("content", `%${search}%`);

        const { data: mentions, error: mErr } = await mentionQuery;
        if (mErr) throw mErr;

        const mentionMap = new Map((mentions || []).map(m => [m.id, m]));

        // If we also filter by source/search, we need accurate total count
        // Re-count with all filters applied
        let actualCount = count || 0;
        if (source || search) {
          // Build a count query that also applies source and search filters through mention join
          // We use the filtered items on this page as a proxy; for accurate cross-page totals
          // we'd need a RPC – for now use the analysis count as an upper bound and note this limitation
          const filteredItemsOnPage = analyses.filter(a => mentionMap.has(a.mention_id));
          // If current page has fewer items than pageSize, we know the true total is from + filteredItems
          if (filteredItemsOnPage.length < pageSize) {
            actualCount = from + filteredItemsOnPage.length;
          }
          // else keep the analyses count (upper bound)
        }

        const items: CommentItem[] = analyses
          .filter(a => mentionMap.has(a.mention_id))
          .map(a => {
            const m = mentionMap.get(a.mention_id)!;
            const eng = m.engagement as Record<string, unknown> | null;
            return {
              id: m.id,
              author: m.author_name || m.author_handle || 'Anônimo',
              source: m.source,
              content: m.content,
              sentiment: a.sentiment === 'positivo' ? 'positive' as const : a.sentiment === 'negativo' ? 'negative' as const : 'neutral' as const,
              category: a.category || 'sem categoria',
              date: m.published_at || m.collected_at,
              likes: Number(eng?.likes) || 0,
              shares: Number(eng?.shares) || 0,
              url: m.source_url || '#',
            };
          });

        return { items, totalCount: actualCount };
      }

      // No sentiment/category filter: query mentions directly with pagination
      let countQuery = supabase
        .from("po_mentions")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", entityId!);

      let dataQuery = supabase
        .from("po_mentions")
        .select("*")
        .eq("entity_id", entityId!)
        .order("published_at", { ascending: false })
        .range(from, to);

      if (source) {
        countQuery = countQuery.eq("source", source);
        dataQuery = dataQuery.eq("source", source);
      }
      if (search) {
        countQuery = countQuery.ilike("content", `%${search}%`);
        dataQuery = dataQuery.ilike("content", `%${search}%`);
      }

      const [{ count }, { data: mentions, error }] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      if (error) throw error;
      if (!mentions || mentions.length === 0) return { items: [], totalCount: count || 0 };

      // Fetch analyses for these mentions
      const mentionIds = mentions.map(m => m.id);
      const { data: analyses } = await supabase
        .from("po_sentiment_analyses")
        .select("mention_id, sentiment, category")
        .in("mention_id", mentionIds);

      const analysisMap = new Map((analyses || []).map(a => [a.mention_id, a]));

      const items: CommentItem[] = mentions.map(m => {
        const a = analysisMap.get(m.id);
        const eng = m.engagement as Record<string, unknown> | null;
        return {
          id: m.id,
          author: m.author_name || m.author_handle || 'Anônimo',
          source: m.source,
          content: m.content,
          sentiment: a ? (a.sentiment === 'positivo' ? 'positive' as const : a.sentiment === 'negativo' ? 'negative' as const : 'neutral' as const) : 'neutral' as const,
          category: a?.category || 'pendente',
          date: m.published_at || m.collected_at,
          likes: Number(eng?.likes) || 0,
          shares: Number(eng?.shares) || 0,
          url: m.source_url || '#',
        };
      });

      return { items, totalCount: count || 0 };
    },
  });
}

function getCategoryVariants(category: string): string[] {
  const variants: Record<string, string[]> = {
    'notícia': ['notícia', 'noticia'],
    'noticia': ['notícia', 'noticia'],
    'dúvida': ['dúvida', 'duvida'],
    'duvida': ['dúvida', 'duvida'],
    'divulgação': ['divulgação', 'divulgacao'],
    'reclamação': ['reclamação', 'reclamacao'],
    'sugestão': ['sugestão', 'sugestao'],
  };
  return variants[category] || [category];
}
