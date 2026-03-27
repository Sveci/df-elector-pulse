-- Limpar cache entries com embeddings gerados pelo hash local (incompatíveis)
DELETE FROM public.brain_cache;

-- Resetar métricas para recomeçar a contagem com embeddings reais
DELETE FROM public.brain_metrics;

-- Resetar sessões
DELETE FROM public.brain_sessions;

-- Limpar embeddings antigos dos kb_chunks para forçar reindexação
UPDATE public.kb_chunks SET embedding = NULL;