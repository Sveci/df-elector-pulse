
-- Unified RPC for sentiment counts that works for both principal and adversary entities
-- Applies relevance filtering (excludes irrelevant analyses and humor with zero score)
CREATE OR REPLACE FUNCTION public.get_entity_sentiment_counts(
  p_entity_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_is_principal boolean DEFAULT false
)
RETURNS TABLE(positive bigint, negative bigint, neutral bigint, total bigint, avg_score numeric) 
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    count(*) FILTER (WHERE sentiment = 'positivo') AS positive,
    count(*) FILTER (WHERE sentiment = 'negativo') AS negative,
    count(*) FILTER (WHERE sentiment = 'neutro') AS neutral,
    count(*) AS total,
    round(avg(sentiment_score)::numeric, 4) AS avg_score
  FROM po_sentiment_analyses
  WHERE 
    CASE 
      WHEN p_is_principal THEN entity_id = p_entity_id
      ELSE adversary_entity_id = p_entity_id
    END
    AND analyzed_at >= p_from
    AND analyzed_at <= p_to
    -- Relevance filter: exclude humor with zero score
    AND NOT (category = 'humor' AND (sentiment_score = 0 OR sentiment_score IS NULL))
    -- Relevance filter: exclude analyses flagged as irrelevant
    AND (ai_summary IS NULL OR NOT (
      lower(ai_summary) LIKE '%irrelevante%'
      OR lower(ai_summary) LIKE '%sem relação%'
      OR lower(ai_summary) LIKE '%sem cunho político%'
      OR lower(ai_summary) LIKE '%não se refere%'
      OR lower(ai_summary) LIKE '%não está relacionad%'
      OR lower(ai_summary) LIKE '%sem conexão%'
      OR lower(ai_summary) LIKE '%não menciona%'
      OR lower(ai_summary) LIKE '%sem relevância%'
      OR lower(ai_summary) LIKE '%não é sobre%'
      OR lower(ai_summary) LIKE '%sem vínculo%'
      OR lower(ai_summary) LIKE '%conteúdo genérico%'
    ));
$$;
