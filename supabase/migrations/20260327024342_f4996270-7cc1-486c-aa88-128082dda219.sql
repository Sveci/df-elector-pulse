
-- =============================================
-- MÓDULO: Cérebro IA — Cache Semântico + Aprendizado Contínuo
-- =============================================

-- Garantir que pgvector está habilitado
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 1. Cache Semântico — pares pergunta/resposta com embedding
CREATE TABLE IF NOT EXISTS public.brain_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT get_default_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  pergunta_original text NOT NULL,
  pergunta_normalizada text NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  
  resposta text NOT NULL,
  resposta_tipo text NOT NULL DEFAULT 'text',
  
  categoria text,
  tags text[],
  intencao text,
  
  score_confianca float NOT NULL DEFAULT 0.8,
  vezes_utilizada integer NOT NULL DEFAULT 0,
  ultima_utilizacao timestamptz,
  feedback_positivo integer NOT NULL DEFAULT 0,
  feedback_negativo integer NOT NULL DEFAULT 0,
  
  origem text NOT NULL DEFAULT 'ai',
  fonte_id text,
  
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Sessões de conversa (contexto multi-turn)
CREATE TABLE IF NOT EXISTS public.brain_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT get_default_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone text NOT NULL,
  
  contexto jsonb NOT NULL DEFAULT '[]'::jsonb,
  intencao_atual text,
  estado text NOT NULL DEFAULT 'ativo',
  caminho text[] DEFAULT '{}',
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes')
);

-- 3. Métricas de aprendizado por tenant
CREATE TABLE IF NOT EXISTS public.brain_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT get_default_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  periodo date NOT NULL,
  
  total_mensagens integer NOT NULL DEFAULT 0,
  resolvidas_por_flow integer NOT NULL DEFAULT 0,
  resolvidas_por_cache integer NOT NULL DEFAULT 0,
  resolvidas_por_kb integer NOT NULL DEFAULT 0,
  resolvidas_por_ia integer NOT NULL DEFAULT 0,
  clarificacoes integer NOT NULL DEFAULT 0,
  tokens_gastos integer NOT NULL DEFAULT 0,
  tokens_economizados integer NOT NULL DEFAULT 0,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(tenant_id, periodo)
);

-- 4. Feedback do usuário sobre respostas
CREATE TABLE IF NOT EXISTS public.brain_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL DEFAULT get_default_tenant_id() REFERENCES public.tenants(id) ON DELETE CASCADE,
  cache_entry_id uuid REFERENCES public.brain_cache(id) ON DELETE SET NULL,
  phone text,
  
  tipo text NOT NULL,
  correcao_texto text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_brain_cache_embedding 
  ON public.brain_cache 
  USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_brain_cache_tenant_ativo 
  ON public.brain_cache(tenant_id, ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_brain_cache_categoria 
  ON public.brain_cache(tenant_id, categoria);
CREATE INDEX IF NOT EXISTS idx_brain_cache_uso 
  ON public.brain_cache(tenant_id, vezes_utilizada DESC);

CREATE INDEX IF NOT EXISTS idx_brain_sessions_phone 
  ON public.brain_sessions(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_brain_sessions_active 
  ON public.brain_sessions(tenant_id, expires_at) WHERE estado != 'resolvido';

CREATE INDEX IF NOT EXISTS idx_brain_metrics_tenant_periodo 
  ON public.brain_metrics(tenant_id, periodo DESC);

-- =============================================
-- Adicionar embedding à tabela kb_chunks existente (se não tem)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'kb_chunks' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE public.kb_chunks ADD COLUMN embedding extensions.vector(1536);
    CREATE INDEX idx_kb_chunks_embedding 
      ON public.kb_chunks 
      USING hnsw (embedding extensions.vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'kb_chunks' AND column_name = 'categoria'
  ) THEN
    ALTER TABLE public.kb_chunks ADD COLUMN categoria text;
    ALTER TABLE public.kb_chunks ADD COLUMN tags text[];
    ALTER TABLE public.kb_chunks ADD COLUMN resumo text;
  END IF;
END $$;

-- =============================================
-- RPC: Busca por similaridade no cache
-- =============================================
CREATE OR REPLACE FUNCTION public.brain_search_cache(
  p_tenant_id uuid,
  p_embedding extensions.vector(1536),
  p_limit integer DEFAULT 3,
  p_threshold float DEFAULT 0.70
)
RETURNS TABLE (
  id uuid,
  pergunta_original text,
  resposta text,
  resposta_tipo text,
  categoria text,
  score_confianca float,
  similaridade float
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bc.id,
    bc.pergunta_original,
    bc.resposta,
    bc.resposta_tipo,
    bc.categoria,
    bc.score_confianca,
    (1 - (bc.embedding <=> p_embedding))::float as similaridade
  FROM public.brain_cache bc
  WHERE bc.tenant_id = p_tenant_id
    AND bc.ativo = true
    AND (bc.expira_em IS NULL OR bc.expira_em > now())
    AND (1 - (bc.embedding <=> p_embedding)) >= p_threshold
  ORDER BY bc.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;

-- =============================================
-- RPC: Busca por similaridade no KB com embedding
-- =============================================
CREATE OR REPLACE FUNCTION public.brain_search_kb(
  p_tenant_id uuid,
  p_embedding extensions.vector(1536),
  p_limit integer DEFAULT 5,
  p_threshold float DEFAULT 0.65
)
RETURNS TABLE (
  id uuid,
  content text,
  resumo text,
  categoria text,
  similaridade float
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kc.id,
    kc.content,
    kc.resumo,
    kc.categoria,
    (1 - (kc.embedding <=> p_embedding))::float as similaridade
  FROM public.kb_chunks kc
  WHERE kc.tenant_id = p_tenant_id
    AND kc.embedding IS NOT NULL
    AND (1 - (kc.embedding <=> p_embedding)) >= p_threshold
  ORDER BY kc.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;

-- =============================================
-- RPC: Incrementar uso do cache
-- =============================================
CREATE OR REPLACE FUNCTION public.brain_cache_hit(p_cache_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.brain_cache
  SET vezes_utilizada = vezes_utilizada + 1,
      ultima_utilizacao = now(),
      updated_at = now()
  WHERE id = p_cache_id;
END;
$$;

-- =============================================
-- RPC: Registrar métrica
-- =============================================
CREATE OR REPLACE FUNCTION public.brain_record_metric(
  p_tenant_id uuid,
  p_camada text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.brain_metrics (tenant_id, periodo, total_mensagens,
    resolvidas_por_flow, resolvidas_por_cache, resolvidas_por_kb, resolvidas_por_ia, clarificacoes)
  VALUES (p_tenant_id, CURRENT_DATE, 1,
    CASE WHEN p_camada = 'flow' THEN 1 ELSE 0 END,
    CASE WHEN p_camada = 'cache' THEN 1 ELSE 0 END,
    CASE WHEN p_camada = 'kb' THEN 1 ELSE 0 END,
    CASE WHEN p_camada = 'ia' THEN 1 ELSE 0 END,
    CASE WHEN p_camada = 'clarificacao' THEN 1 ELSE 0 END)
  ON CONFLICT (tenant_id, periodo)
  DO UPDATE SET
    total_mensagens = brain_metrics.total_mensagens + 1,
    resolvidas_por_flow = brain_metrics.resolvidas_por_flow + CASE WHEN p_camada = 'flow' THEN 1 ELSE 0 END,
    resolvidas_por_cache = brain_metrics.resolvidas_por_cache + CASE WHEN p_camada = 'cache' THEN 1 ELSE 0 END,
    resolvidas_por_kb = brain_metrics.resolvidas_por_kb + CASE WHEN p_camada = 'kb' THEN 1 ELSE 0 END,
    resolvidas_por_ia = brain_metrics.resolvidas_por_ia + CASE WHEN p_camada = 'ia' THEN 1 ELSE 0 END,
    clarificacoes = brain_metrics.clarificacoes + CASE WHEN p_camada = 'clarificacao' THEN 1 ELSE 0 END;
END;
$$;

-- =============================================
-- TRIGGER: updated_at automático
-- =============================================
CREATE OR REPLACE FUNCTION public.brain_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_brain_cache_updated_at
  BEFORE UPDATE ON public.brain_cache
  FOR EACH ROW EXECUTE FUNCTION public.brain_update_timestamp();

CREATE TRIGGER trg_brain_sessions_updated_at
  BEFORE UPDATE ON public.brain_sessions
  FOR EACH ROW EXECUTE FUNCTION public.brain_update_timestamp();

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE public.brain_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_feedback ENABLE ROW LEVEL SECURITY;

-- Service role: acesso total (edge functions usam service role)
CREATE POLICY "brain_cache_service" ON public.brain_cache FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "brain_sessions_service" ON public.brain_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "brain_metrics_service" ON public.brain_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "brain_feedback_service" ON public.brain_feedback FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated: apenas o próprio tenant
CREATE POLICY "brain_cache_tenant" ON public.brain_cache FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));
CREATE POLICY "brain_sessions_tenant" ON public.brain_sessions FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));
CREATE POLICY "brain_metrics_tenant" ON public.brain_metrics FOR SELECT TO authenticated
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())));
CREATE POLICY "brain_feedback_tenant_all" ON public.brain_feedback FOR ALL TO authenticated
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- =============================================
-- CRON: Limpar sessões expiradas (a cada hora)
-- =============================================
SELECT cron.schedule(
  'brain-cleanup-sessions',
  '0 * * * *',
  $$DELETE FROM public.brain_sessions WHERE expires_at < now();$$
);

-- =============================================
-- Realtime para brain_metrics
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.brain_metrics;
