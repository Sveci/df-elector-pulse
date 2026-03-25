
-- Tabela principal de proposições monitoradas
CREATE TABLE IF NOT EXISTS public.proposicoes_monitoradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT ''::text,
  casa text NOT NULL DEFAULT 'camara',
  camara_id integer,
  senado_codigo integer,
  sigla_tipo text NOT NULL,
  numero integer NOT NULL,
  ano integer NOT NULL,
  ementa text,
  ementa_detalhada text,
  keywords text[],
  url_inteiro_teor text,
  autor_nome text,
  autor_partido text,
  autor_uf text,
  cod_situacao integer,
  descricao_situacao text,
  sigla_orgao_situacao text,
  data_situacao text,
  regime text,
  apreciacao text,
  ultima_sequencia_camara integer NOT NULL DEFAULT 0,
  ultima_data_tramitacao text,
  ultima_verificacao_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, casa, sigla_tipo, numero, ano)
);

ALTER TABLE public.proposicoes_monitoradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant proposicoes" ON public.proposicoes_monitoradas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own tenant proposicoes" ON public.proposicoes_monitoradas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own tenant proposicoes" ON public.proposicoes_monitoradas
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Service role full access proposicoes" ON public.proposicoes_monitoradas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tabela de tramitações
CREATE TABLE IF NOT EXISTS public.proposicoes_tramitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposicao_id uuid NOT NULL REFERENCES public.proposicoes_monitoradas(id) ON DELETE CASCADE,
  tenant_id text NOT NULL DEFAULT ''::text,
  sequencia integer NOT NULL,
  data_hora timestamptz,
  sigla_orgao text,
  uri_orgao text,
  cod_tipo_tramitacao integer,
  descricao_tramitacao text,
  cod_situacao integer,
  descricao_situacao text,
  despacho text,
  url_documento text,
  regime text,
  eh_evento_critico boolean DEFAULT false,
  grupo_situacao text DEFAULT 'tramitando',
  notificado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proposicao_id, sequencia)
);

ALTER TABLE public.proposicoes_tramitacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant tramitacoes" ON public.proposicoes_tramitacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access tramitacoes" ON public.proposicoes_tramitacoes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tabela de configuração de alertas
CREATE TABLE IF NOT EXISTS public.proposicoes_alertas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT ''::text,
  nome text NOT NULL,
  provider text NOT NULL DEFAULT 'zapi',
  tipo_destino text NOT NULL DEFAULT 'individual',
  destino text NOT NULL,
  destino_nome text,
  eventos_criticos_only boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposicoes_alertas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tenant alertas" ON public.proposicoes_alertas_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access alertas" ON public.proposicoes_alertas_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tabela de log de notificações
CREATE TABLE IF NOT EXISTS public.proposicoes_notificacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposicao_id uuid REFERENCES public.proposicoes_monitoradas(id) ON DELETE CASCADE,
  tramitacao_id uuid REFERENCES public.proposicoes_tramitacoes(id) ON DELETE SET NULL,
  alerta_config_id uuid REFERENCES public.proposicoes_alertas_config(id) ON DELETE SET NULL,
  tenant_id text NOT NULL DEFAULT ''::text,
  mensagem_enviada text,
  provider_usado text,
  destino text,
  whatsapp_message_id text,
  status text DEFAULT 'pending',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposicoes_notificacoes_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant notif log" ON public.proposicoes_notificacoes_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full access notif log" ON public.proposicoes_notificacoes_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
