-- ================================================================
-- WHATSAPP CHATBOT - COMPREHENSIVE IMPROVEMENTS
-- Auditoria completa: segurança, multi-tenant, IA conversacional,
-- confiabilidade e UX
-- ================================================================

-- ----------------------------------------------------------------
-- 1. ADD tenant_id TO EXISTING CHATBOT TABLES (multi-tenancy fix)
-- ----------------------------------------------------------------

-- whatsapp_chatbot_config: add tenant_id column
ALTER TABLE public.whatsapp_chatbot_config
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- whatsapp_chatbot_keywords: add tenant_id column
ALTER TABLE public.whatsapp_chatbot_keywords
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- whatsapp_chatbot_logs: add tenant_id column
ALTER TABLE public.whatsapp_chatbot_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------
-- 2. BACKFILL tenant_id WITH DEFAULT TENANT (data migration)
-- ----------------------------------------------------------------
UPDATE public.whatsapp_chatbot_config
  SET tenant_id = public.get_default_tenant_id()
  WHERE tenant_id IS NULL;

UPDATE public.whatsapp_chatbot_keywords
  SET tenant_id = public.get_default_tenant_id()
  WHERE tenant_id IS NULL;

UPDATE public.whatsapp_chatbot_logs
  SET tenant_id = public.get_default_tenant_id()
  WHERE tenant_id IS NULL;

-- ----------------------------------------------------------------
-- 3. UPDATE RLS POLICIES FOR MULTI-TENANT ISOLATION
-- ----------------------------------------------------------------

-- Drop old policies
DROP POLICY IF EXISTS "whatsapp_chatbot_config_select" ON public.whatsapp_chatbot_config;
DROP POLICY IF EXISTS "whatsapp_chatbot_config_modify" ON public.whatsapp_chatbot_config;
DROP POLICY IF EXISTS "whatsapp_chatbot_keywords_select" ON public.whatsapp_chatbot_keywords;
DROP POLICY IF EXISTS "whatsapp_chatbot_keywords_modify" ON public.whatsapp_chatbot_keywords;
DROP POLICY IF EXISTS "whatsapp_chatbot_logs_select" ON public.whatsapp_chatbot_logs;
DROP POLICY IF EXISTS "whatsapp_chatbot_logs_insert_public" ON public.whatsapp_chatbot_logs;

-- Config: admin can only see/modify their own tenant's config
CREATE POLICY "chatbot_config_tenant_select"
  ON public.whatsapp_chatbot_config FOR SELECT
  TO authenticated
  USING (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  );

CREATE POLICY "chatbot_config_tenant_modify"
  ON public.whatsapp_chatbot_config FOR ALL
  TO authenticated
  USING (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  )
  WITH CHECK (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  );

CREATE POLICY "chatbot_config_service_role"
  ON public.whatsapp_chatbot_config FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Keywords: admin can only see/modify their own tenant's keywords
CREATE POLICY "chatbot_keywords_tenant_select"
  ON public.whatsapp_chatbot_keywords FOR SELECT
  TO authenticated
  USING (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  );

CREATE POLICY "chatbot_keywords_tenant_modify"
  ON public.whatsapp_chatbot_keywords FOR ALL
  TO authenticated
  USING (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  )
  WITH CHECK (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  );

CREATE POLICY "chatbot_keywords_service_role"
  ON public.whatsapp_chatbot_keywords FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- Logs: admin can see their tenant's logs; service role can insert
CREATE POLICY "chatbot_logs_tenant_select"
  ON public.whatsapp_chatbot_logs FOR SELECT
  TO authenticated
  USING (
    tenant_id = ANY(public.get_user_tenant_ids(auth.uid()))
    AND public.has_admin_access(auth.uid())
  );

CREATE POLICY "chatbot_logs_service_insert"
  ON public.whatsapp_chatbot_logs FOR INSERT
  TO service_role WITH CHECK (true);

CREATE POLICY "chatbot_logs_public_insert"
  ON public.whatsapp_chatbot_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "chatbot_logs_service_all"
  ON public.whatsapp_chatbot_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 4. ENHANCE whatsapp_chatbot_sessions TABLE
--    - Add conversation_history (JSONB) for AI context
--    - Add last_activity_at for session expiry management
--    - Add invite_sent_count to prevent double-invites
--    - Add last_invite_at to rate-limit registration invites
--    - Add metadata for extensibility
-- ----------------------------------------------------------------
ALTER TABLE public.whatsapp_chatbot_sessions
  ADD COLUMN IF NOT EXISTS conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS invite_sent_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_invite_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS context_data JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS session_expired_at TIMESTAMPTZ DEFAULT NULL;

-- ----------------------------------------------------------------
-- 5. INDEXES FOR PERFORMANCE
-- ----------------------------------------------------------------

-- Chatbot config: tenant lookup
CREATE INDEX IF NOT EXISTS idx_chatbot_config_tenant
  ON public.whatsapp_chatbot_config(tenant_id);

-- Chatbot keywords: tenant + active lookup (most common query)
CREATE INDEX IF NOT EXISTS idx_chatbot_keywords_tenant_active
  ON public.whatsapp_chatbot_keywords(tenant_id, is_active, priority DESC);

-- Chatbot logs: tenant + time (most common query for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_tenant_created
  ON public.whatsapp_chatbot_logs(tenant_id, created_at DESC);

-- Chatbot logs: phone lookup for rate limiting
CREATE INDEX IF NOT EXISTS idx_chatbot_logs_phone_created
  ON public.whatsapp_chatbot_logs(phone, created_at DESC);

-- Sessions: last_activity_at for expiry cleanup
CREATE INDEX IF NOT EXISTS idx_chatbot_sessions_activity
  ON public.whatsapp_chatbot_sessions(last_activity_at);

-- ----------------------------------------------------------------
-- 6. ADD MISSING "PENDENTES" KEYWORD TO DEFAULT DATA
-- ----------------------------------------------------------------
INSERT INTO public.whatsapp_chatbot_keywords (
  keyword, aliases, description, response_type, dynamic_function, priority, is_active, tenant_id
)
SELECT
  'PENDENTES',
  ARRAY['VERIFICACOES', 'NAO VERIFICADOS', 'AGUARDANDO'],
  'Mostra subordinados pendentes de verificação',
  'dynamic',
  'pendentes',
  10,
  true,
  public.get_default_tenant_id()
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_chatbot_keywords WHERE keyword = 'PENDENTES'
);

-- Also update existing keywords with the default tenant_id (if they have none)
UPDATE public.whatsapp_chatbot_keywords
  SET tenant_id = public.get_default_tenant_id()
  WHERE tenant_id IS NULL
    AND keyword IN ('ARVORE', 'CADASTROS', 'PONTOS', 'RANKING', 'SUBORDINADOS', 'AJUDA', 'PENDENTES');

-- ----------------------------------------------------------------
-- 7. ADD MESSAGE DEDUPLICATION TABLE
--    Tracks recently processed message IDs to prevent double processing
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);

ALTER TABLE public.whatsapp_processed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processed_messages_service_role"
  ON public.whatsapp_processed_messages FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_processed_messages_id
  ON public.whatsapp_processed_messages(message_id);

CREATE INDEX IF NOT EXISTS idx_processed_messages_processed_at
  ON public.whatsapp_processed_messages(processed_at);

-- Auto-cleanup: remove entries older than 24 hours (prevents table bloat)
-- This is handled by the edge function, but index helps performance

-- ----------------------------------------------------------------
-- 8. ADD WHATSAPP RATE LIMITING TABLE (server-side, per tenant)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  message_count INTEGER NOT NULL DEFAULT 1,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone, window_start)
);

ALTER TABLE public.whatsapp_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_service_role"
  ON public.whatsapp_rate_limits FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_rate_limits_tenant_phone
  ON public.whatsapp_rate_limits(tenant_id, phone, window_start DESC);

-- ----------------------------------------------------------------
-- 9. ADD WHATSAPP CHATBOT STATS VIEW (for admin dashboard)
-- ----------------------------------------------------------------
CREATE OR REPLACE VIEW public.whatsapp_chatbot_stats AS
SELECT
  tenant_id,
  COUNT(*) AS total_interactions,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') AS interactions_24h,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '7 days') AS interactions_7d,
  COUNT(DISTINCT phone) AS unique_users,
  COUNT(DISTINCT phone) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') AS unique_users_24h,
  COUNT(*) FILTER (WHERE response_type = 'ai') AS ai_responses,
  COUNT(*) FILTER (WHERE response_type = 'dynamic') AS dynamic_responses,
  COUNT(*) FILTER (WHERE response_type = 'static') AS static_responses,
  COUNT(*) FILTER (WHERE response_type = 'fallback') AS fallback_responses,
  ROUND(AVG(processing_time_ms)) AS avg_processing_ms,
  MAX(created_at) AS last_interaction_at
FROM public.whatsapp_chatbot_logs
GROUP BY tenant_id;

-- ----------------------------------------------------------------
-- 10. FUNCTION: Clean old processed messages (called by edge function)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_processed_messages()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.whatsapp_processed_messages
  WHERE processed_at < now() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ----------------------------------------------------------------
-- 11. FUNCTION: Check and record deduplication
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_record_message(
  p_message_id TEXT,
  p_phone TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN  -- returns TRUE if message is NEW (not a duplicate)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Try to insert; if conflict (duplicate), return false
  INSERT INTO public.whatsapp_processed_messages (message_id, phone, tenant_id)
  VALUES (p_message_id, p_phone, p_tenant_id);

  RETURN TRUE; -- new message
EXCEPTION
  WHEN unique_violation THEN
    RETURN FALSE; -- duplicate
END;
$$;

-- ----------------------------------------------------------------
-- 12. ADD RPC FOR SESSION MANAGEMENT
-- ----------------------------------------------------------------

-- Get or create session with last_activity update
CREATE OR REPLACE FUNCTION public.upsert_chatbot_session(
  p_phone TEXT,
  p_tenant_id UUID
)
RETURNS public.whatsapp_chatbot_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.whatsapp_chatbot_sessions;
  v_expiry_hours CONSTANT INTEGER := 24;
BEGIN
  -- Try to get existing non-expired session
  SELECT * INTO v_session
  FROM public.whatsapp_chatbot_sessions
  WHERE phone = p_phone
    AND tenant_id = p_tenant_id
    AND (session_expired_at IS NULL OR session_expired_at > now())
  LIMIT 1;

  IF v_session IS NULL THEN
    -- Create new session
    INSERT INTO public.whatsapp_chatbot_sessions (
      phone, tenant_id, first_message_at, last_activity_at, conversation_history
    )
    VALUES (p_phone, p_tenant_id, now(), now(), '[]'::jsonb)
    ON CONFLICT (phone, tenant_id) DO UPDATE
      SET last_activity_at = now(),
          session_expired_at = NULL  -- reactivate if expired
    RETURNING * INTO v_session;
  ELSE
    -- Update last activity
    UPDATE public.whatsapp_chatbot_sessions
    SET last_activity_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
  END IF;

  RETURN v_session;
END;
$$;

-- ----------------------------------------------------------------
-- 13. ADD COLUMN FOR UNIQUE CONSTRAINT SAFETY
--     Some older schemas may not have unique constraint on (phone,tenant_id)
-- ----------------------------------------------------------------
DO $$
BEGIN
  -- Add unique constraint if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_chatbot_sessions_phone_tenant_id_key'
      AND conrelid = 'public.whatsapp_chatbot_sessions'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_chatbot_sessions
      ADD CONSTRAINT whatsapp_chatbot_sessions_phone_tenant_id_key
      UNIQUE (phone, tenant_id);
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 14. UPDATE whatsapp_messages TABLE: add tenant_id if missing
-- ----------------------------------------------------------------
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_tenant_created
  ON public.whatsapp_messages(tenant_id, created_at DESC);

-- ----------------------------------------------------------------
-- 15. FUNCTION: Append conversation turn to session history
--     Used by edge function to maintain AI conversation context
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.append_conversation_turn(
  p_session_id UUID,
  p_role TEXT,   -- 'user' or 'assistant'
  p_content TEXT,
  p_max_turns INTEGER DEFAULT 10
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_turn JSONB;
  v_history JSONB;
BEGIN
  v_new_turn := jsonb_build_object(
    'role', p_role,
    'content', p_content,
    'ts', extract(epoch from now())::bigint
  );

  -- Append new turn and keep only last p_max_turns turns
  UPDATE public.whatsapp_chatbot_sessions
  SET
    conversation_history = (
      SELECT jsonb_agg(turn)
      FROM (
        SELECT turn
        FROM jsonb_array_elements(
          COALESCE(conversation_history, '[]'::jsonb) || jsonb_build_array(v_new_turn)
        ) AS turn
        ORDER BY (turn->>'ts')::bigint ASC
        LIMIT p_max_turns * 2  -- *2 because each exchange is 2 turns
      ) sub
    ),
    last_activity_at = now()
  WHERE id = p_session_id;
END;
$$;
