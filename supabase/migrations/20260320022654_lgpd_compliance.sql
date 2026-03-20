-- ============================================================
-- LGPD Compliance Migration
-- Tables: lgpd_consent_logs, lgpd_rights_requests
-- ============================================================

-- ── 1. lgpd_consent_logs ─────────────────────────────────────
-- Records every consent event (cookie banner, form submission)
-- with proof required by LGPD Art. 8 §5 (ônus da prova)
CREATE TABLE IF NOT EXISTS public.lgpd_consent_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.organization(id) ON DELETE SET NULL,
  -- who gave consent (null = anonymous / public form)
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- contact record if applicable
  contact_id    uuid,
  -- type: 'cookie_all' | 'cookie_essential' | 'form_submission' | 'leader_registration' | 'event_registration' | 'lead_capture' | 'unsubscribe'
  consent_type  text NOT NULL,
  -- 'granted' | 'revoked' | 'essential_only'
  action        text NOT NULL CHECK (action IN ('granted', 'revoked', 'essential_only')),
  -- legal basis: LGPD Art. 7 (I=consent, V=contract, IX=legitimate_interest, II=legal_obligation)
  legal_basis   text NOT NULL DEFAULT 'consent',
  -- client IP (anonymised: last octet zeroed for IPv4)
  ip_address    text,
  -- browser / device info (truncated)
  user_agent    text,
  -- URL where consent was given
  page_url      text,
  -- free-form metadata (form name, template version, etc.)
  metadata      jsonb DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lgpd_consent_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all logs for their tenant
CREATE POLICY "lgpd_consent_logs_admin_select" ON public.lgpd_consent_logs
  FOR SELECT USING (
    tenant_id IN (SELECT unnest(get_user_tenant_ids()))
    AND has_admin_access()
  );

-- Anyone can insert (public forms need to log consent without auth)
CREATE POLICY "lgpd_consent_logs_insert_public" ON public.lgpd_consent_logs
  FOR INSERT WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS lgpd_consent_logs_tenant_idx ON public.lgpd_consent_logs (tenant_id);
CREATE INDEX IF NOT EXISTS lgpd_consent_logs_created_idx ON public.lgpd_consent_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS lgpd_consent_logs_contact_idx ON public.lgpd_consent_logs (contact_id) WHERE contact_id IS NOT NULL;

-- ── 2. lgpd_rights_requests ──────────────────────────────────
-- Tracks data-subject rights requests (LGPD Art. 18)
CREATE TABLE IF NOT EXISTS public.lgpd_rights_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid REFERENCES public.organization(id) ON DELETE SET NULL,
  -- requester info
  requester_name   text NOT NULL,
  requester_email  text NOT NULL,
  requester_phone  text,
  -- type of request (Art. 18): access | correction | deletion | portability | revoke_consent | anonymization | info
  request_type  text NOT NULL CHECK (request_type IN (
    'access', 'correction', 'deletion', 'portability',
    'revoke_consent', 'anonymization', 'info'
  )),
  -- 'pending' | 'in_progress' | 'completed' | 'rejected'
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  -- requester's description
  description   text,
  -- admin response
  response_text text,
  responded_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at  timestamptz,
  -- deadline: LGPD Art. 18 §4 – 15 dias úteis; we store the calendar deadline
  deadline_at   timestamptz GENERATED ALWAYS AS (created_at + INTERVAL '15 days') STORED,
  -- proof
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lgpd_rights_requests ENABLE ROW LEVEL SECURITY;

-- Admins can see and update requests for their tenant
CREATE POLICY "lgpd_rights_requests_admin_all" ON public.lgpd_rights_requests
  FOR ALL USING (
    tenant_id IN (SELECT unnest(get_user_tenant_ids()))
    AND has_admin_access()
  );

-- Public insert (anyone can submit a rights request)
CREATE POLICY "lgpd_rights_requests_insert_public" ON public.lgpd_rights_requests
  FOR INSERT WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS lgpd_rights_requests_tenant_idx ON public.lgpd_rights_requests (tenant_id);
CREATE INDEX IF NOT EXISTS lgpd_rights_requests_status_idx ON public.lgpd_rights_requests (status);
CREATE INDEX IF NOT EXISTS lgpd_rights_requests_created_idx ON public.lgpd_rights_requests (created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_lgpd_rights_requests_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lgpd_rights_requests_updated_at ON public.lgpd_rights_requests;
CREATE TRIGGER lgpd_rights_requests_updated_at
  BEFORE UPDATE ON public.lgpd_rights_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_lgpd_rights_requests_updated_at();

-- ── 3. Extend office_contacts with LGPD fields ────────────────
-- Add consent_at and consent_ip columns if not present
ALTER TABLE public.office_contacts
  ADD COLUMN IF NOT EXISTS consent_at   timestamptz,
  ADD COLUMN IF NOT EXISTS consent_ip   text,
  ADD COLUMN IF NOT EXISTS consent_type text; -- 'leader_registration' | 'lead_capture' | 'event_registration' | 'manual'

-- ── 4. Helper: RPC for anonymous consent insert ───────────────
-- Allows public forms to log consent without being authenticated
CREATE OR REPLACE FUNCTION public.log_lgpd_consent(
  p_tenant_id    uuid,
  p_contact_id   uuid,
  p_consent_type text,
  p_action       text,
  p_legal_basis  text,
  p_ip_address   text,
  p_user_agent   text,
  p_page_url     text,
  p_metadata     jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.lgpd_consent_logs (
    tenant_id, contact_id, consent_type, action,
    legal_basis, ip_address, user_agent, page_url, metadata
  ) VALUES (
    p_tenant_id, p_contact_id, p_consent_type, p_action,
    p_legal_basis, p_ip_address, p_user_agent, p_page_url, p_metadata
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Grant execute to anonymous role so public forms can call it
GRANT EXECUTE ON FUNCTION public.log_lgpd_consent TO anon, authenticated;
