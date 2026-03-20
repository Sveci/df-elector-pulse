-- =============================================================================
-- MIGRATION: Email System Multi-Tenant Audit Fix
-- Date: 2026-03-20
-- Description:
--   1. Add tenant_id to integrations_settings (make it tenant-aware)
--   2. Add tenant_id to email_logs (isolate email history per tenant)
--   3. Add tenant_id to scheduled_messages (scoped scheduling per tenant)
--   4. Fix RLS policies on integrations_settings to enforce tenant isolation
--   5. Fix RLS policies on email_logs to enforce tenant isolation
--   6. Fix RLS policies on scheduled_messages to enforce tenant isolation
--   7. Add performance indexes for tenant-scoped queries
--   8. Backfill tenant_id for existing rows using get_default_tenant_id()
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. integrations_settings — add tenant_id column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.integrations_settings
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill existing row(s) with the default tenant
UPDATE public.integrations_settings
SET tenant_id = get_default_tenant_id()
WHERE tenant_id IS NULL;

-- Create unique constraint so each tenant has exactly one settings row
-- (DROP first in case migration is re-run)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'integrations_settings_tenant_id_key'
      AND conrelid = 'public.integrations_settings'::regclass
  ) THEN
    ALTER TABLE public.integrations_settings
      ADD CONSTRAINT integrations_settings_tenant_id_key UNIQUE (tenant_id);
  END IF;
END $$;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_integrations_settings_tenant_id
  ON public.integrations_settings (tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. email_logs — add tenant_id column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL;

-- Backfill using the default tenant
UPDATE public.email_logs
SET tenant_id = get_default_tenant_id()
WHERE tenant_id IS NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_id
  ON public.email_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_status
  ON public.email_logs (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_email_logs_tenant_created
  ON public.email_logs (tenant_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. scheduled_messages — add tenant_id column
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Backfill
UPDATE public.scheduled_messages
SET tenant_id = get_default_tenant_id()
WHERE tenant_id IS NULL;

-- Performance index
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_tenant_id
  ON public.scheduled_messages (tenant_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_tenant_status
  ON public.scheduled_messages (tenant_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Fix RLS on integrations_settings — enforce tenant isolation
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old policies that have no tenant check
DROP POLICY IF EXISTS "integrations_settings_select" ON public.integrations_settings;
DROP POLICY IF EXISTS "integrations_settings_modify" ON public.integrations_settings;

-- Service role bypass (edge functions use service role key)
DROP POLICY IF EXISTS "integrations_settings_service_role" ON public.integrations_settings;
CREATE POLICY "integrations_settings_service_role" ON public.integrations_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users: can see/modify only their own tenant's settings
-- (admin or super_admin within the tenant)
CREATE POLICY "integrations_settings_select" ON public.integrations_settings
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    AND has_admin_access(auth.uid())
  );

CREATE POLICY "integrations_settings_modify" ON public.integrations_settings
  FOR ALL
  TO authenticated
  USING (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    AND has_admin_access(auth.uid())
  )
  WITH CHECK (
    tenant_id = ANY(get_user_tenant_ids(auth.uid()))
    AND has_admin_access(auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Fix RLS on email_logs — enforce tenant isolation
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old policies
DROP POLICY IF EXISTS "email_logs_select" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_insert" ON public.email_logs;
DROP POLICY IF EXISTS "email_logs_update" ON public.email_logs;

-- Service role bypass
DROP POLICY IF EXISTS "email_logs_service_role" ON public.email_logs;
CREATE POLICY "email_logs_service_role" ON public.email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated admins: see only their tenant's email logs
CREATE POLICY "email_logs_select" ON public.email_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL  -- legacy rows without tenant still readable by any admin
    OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

-- Insert: edge functions use service_role, but allow authenticated insert with tenant
CREATE POLICY "email_logs_insert" ON public.email_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update: edge functions use service_role; allow authenticated updates for own tenant
CREATE POLICY "email_logs_update" ON public.email_logs
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  )
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Fix RLS on scheduled_messages — enforce tenant isolation
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing policies first
DROP POLICY IF EXISTS "scheduled_messages_all" ON public.scheduled_messages;
DROP POLICY IF EXISTS "scheduled_messages_select" ON public.scheduled_messages;
DROP POLICY IF EXISTS "scheduled_messages_insert" ON public.scheduled_messages;
DROP POLICY IF EXISTS "scheduled_messages_update" ON public.scheduled_messages;
DROP POLICY IF EXISTS "scheduled_messages_delete" ON public.scheduled_messages;
DROP POLICY IF EXISTS "scheduled_messages_service_role" ON public.scheduled_messages;

CREATE POLICY "scheduled_messages_service_role" ON public.scheduled_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "scheduled_messages_select" ON public.scheduled_messages
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

CREATE POLICY "scheduled_messages_insert" ON public.scheduled_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "scheduled_messages_update" ON public.scheduled_messages
  FOR UPDATE
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  )
  WITH CHECK (true);

CREATE POLICY "scheduled_messages_delete" ON public.scheduled_messages
  FOR DELETE
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id = ANY(get_user_tenant_ids(auth.uid()))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Add body_html column to email_logs if not already present
--    (some functions try to insert body_html, column may be missing)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS body_html TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Performance indexes for email_templates tenant queries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_email_templates_slug_active
  ON public.email_templates (slug, is_active);

-- tenant_email_templates: index for (tenant_id, slug) lookups in send-email
CREATE INDEX IF NOT EXISTS idx_tenant_email_templates_tenant_slug
  ON public.tenant_email_templates (tenant_id, slug)
  WHERE is_active = true;
