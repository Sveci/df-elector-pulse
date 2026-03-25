-- =====================================================
-- Módulo de Monitoramento de Proposições Legislativas
-- Câmara dos Deputados + Senado Federal
-- =====================================================

-- 1. Proposições monitoradas por tenant
CREATE TABLE IF NOT EXISTS public.proposicoes_monitoradas (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                 uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  -- Identificação da proposição
  casa                      text NOT NULL CHECK (casa IN ('camara', 'senado')),
  camara_id                 integer,           -- ID numérico da API da Câmara
  senado_codigo             integer,           -- Código da API do Senado
  sigla_tipo                text NOT NULL,     -- PL, PEC, PDL, PLP, etc.
  numero                    integer NOT NULL,
  ano                       integer NOT NULL,
  ementa                    text,
  ementa_detalhada          text,
  keywords                  text[],
  url_inteiro_teor          text,
  -- Autoria
  autor_nome                text,
  autor_partido             text,
  autor_uf                  text,
  -- Situação atual
  cod_situacao              integer,
  descricao_situacao        text,
  sigla_orgao_situacao      text,
  data_situacao             timestamptz,
  regime                    text,
  apreciacao                text,
  -- Controle de monitoramento
  ultima_sequencia_camara   integer DEFAULT 0,
  ultima_data_tramitacao    timestamptz,
  ultima_verificacao_em     timestamptz,
  -- Metadados
  ativo                     boolean NOT NULL DEFAULT true,
  criado_por                uuid REFERENCES auth.users(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  -- Evitar duplicatas por tenant
  UNIQUE (tenant_id, casa, sigla_tipo, numero, ano)
);

-- 2. Cache de tramitações detectadas
CREATE TABLE IF NOT EXISTS public.proposicoes_tramitacoes (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposicao_id             uuid NOT NULL REFERENCES public.proposicoes_monitoradas(id) ON DELETE CASCADE,
  tenant_id                 uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  -- Dados da tramitação (Câmara)
  sequencia                 integer,
  data_hora                 timestamptz NOT NULL,
  sigla_orgao               text,
  uri_orgao                 text,
  cod_tipo_tramitacao       integer,
  descricao_tramitacao      text,
  cod_situacao              integer,
  descricao_situacao        text,
  despacho                  text,
  url_documento             text,
  regime                    text,
  -- Classificação do evento
  eh_evento_critico         boolean NOT NULL DEFAULT false,
  grupo_situacao            text CHECK (grupo_situacao IN ('tramitando', 'aprovada', 'arquivada', 'atencao')),
  -- Controle de notificação
  notificado_em             timestamptz,
  created_at                timestamptz NOT NULL DEFAULT now(),
  -- Evitar duplicatas
  UNIQUE (proposicao_id, sequencia)
);

-- 3. Configuração de alertas WhatsApp por tenant
CREATE TABLE IF NOT EXISTS public.proposicoes_alertas_config (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id                 uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  nome                      text NOT NULL,
  -- Provedor WhatsApp
  provider                  text NOT NULL CHECK (provider IN ('zapi', 'meta_cloud')),
  -- Destino
  tipo_destino              text NOT NULL CHECK (tipo_destino IN ('individual', 'grupo_zapi')),
  destino                   text NOT NULL,    -- phone E164 ou group_id@g.us
  destino_nome              text,             -- nome amigável para exibição
  -- Filtros
  eventos_criticos_only     boolean NOT NULL DEFAULT true,
  -- Habilitar/desabilitar
  ativo                     boolean NOT NULL DEFAULT true,
  criado_por                uuid REFERENCES auth.users(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 4. Log de notificações enviadas
CREATE TABLE IF NOT EXISTS public.proposicoes_notificacoes_log (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposicao_id             uuid NOT NULL REFERENCES public.proposicoes_monitoradas(id) ON DELETE CASCADE,
  tramitacao_id             uuid NOT NULL REFERENCES public.proposicoes_tramitacoes(id) ON DELETE CASCADE,
  alerta_config_id          uuid REFERENCES public.proposicoes_alertas_config(id) ON DELETE SET NULL,
  tenant_id                 uuid NOT NULL REFERENCES public.organization(id) ON DELETE CASCADE,
  mensagem_enviada          text,
  provider_usado            text,
  destino                   text,
  whatsapp_message_id       uuid,             -- FK para whatsapp_messages.id (quando disponível)
  status                    text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  erro                      text,
  enviado_em                timestamptz NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_prop_monitoradas_tenant ON public.proposicoes_monitoradas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prop_monitoradas_ativo ON public.proposicoes_monitoradas(tenant_id, ativo);
CREATE INDEX IF NOT EXISTS idx_prop_monitoradas_casa ON public.proposicoes_monitoradas(casa, camara_id);
CREATE INDEX IF NOT EXISTS idx_prop_tramitacoes_proposicao ON public.proposicoes_tramitacoes(proposicao_id);
CREATE INDEX IF NOT EXISTS idx_prop_tramitacoes_tenant ON public.proposicoes_tramitacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prop_tramitacoes_critico ON public.proposicoes_tramitacoes(tenant_id, eh_evento_critico);
CREATE INDEX IF NOT EXISTS idx_prop_tramitacoes_nao_notificado ON public.proposicoes_tramitacoes(tenant_id, notificado_em) WHERE notificado_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_prop_alertas_tenant ON public.proposicoes_alertas_config(tenant_id, ativo);
CREATE INDEX IF NOT EXISTS idx_prop_notif_log_tenant ON public.proposicoes_notificacoes_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prop_notif_log_proposicao ON public.proposicoes_notificacoes_log(proposicao_id);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_proposicoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_proposicoes_monitoradas_updated_at
  BEFORE UPDATE ON public.proposicoes_monitoradas
  FOR EACH ROW EXECUTE FUNCTION public.update_proposicoes_updated_at();

CREATE TRIGGER trg_proposicoes_alertas_updated_at
  BEFORE UPDATE ON public.proposicoes_alertas_config
  FOR EACH ROW EXECUTE FUNCTION public.update_proposicoes_updated_at();

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================
ALTER TABLE public.proposicoes_monitoradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposicoes_tramitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposicoes_alertas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposicoes_notificacoes_log ENABLE ROW LEVEL SECURITY;

-- Service role: acesso total
CREATE POLICY "prop_monitoradas_service_role" ON public.proposicoes_monitoradas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "prop_tramitacoes_service_role" ON public.proposicoes_tramitacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "prop_alertas_service_role" ON public.proposicoes_alertas_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "prop_notif_log_service_role" ON public.proposicoes_notificacoes_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Usuários autenticados: acesso apenas ao próprio tenant
CREATE POLICY "prop_monitoradas_tenant_select" ON public.proposicoes_monitoradas
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.organization WHERE id = tenant_id
        AND id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "prop_monitoradas_tenant_insert" ON public.proposicoes_monitoradas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "prop_monitoradas_tenant_update" ON public.proposicoes_monitoradas
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "prop_monitoradas_tenant_delete" ON public.proposicoes_monitoradas
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "prop_tramitacoes_tenant_select" ON public.proposicoes_tramitacoes
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "prop_tramitacoes_tenant_insert" ON public.proposicoes_tramitacoes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "prop_alertas_tenant_all" ON public.proposicoes_alertas_config
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "prop_notif_log_tenant_select" ON public.proposicoes_notificacoes_log
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- =====================================================
-- CRON JOB via pg_cron (executa a cada 6 horas)
-- =====================================================
SELECT cron.schedule(
  'monitor-proposicoes-legislativas',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url    := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/monitor-proposicoes',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY') || '"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
