CREATE OR REPLACE FUNCTION public.get_adversary_sentiment_counts(
  p_entity_id uuid,
  p_from timestamptz,
  p_to timestamptz
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
  WHERE adversary_entity_id = p_entity_id
    AND analyzed_at >= p_from
    AND analyzed_at <= p_to;
$$;