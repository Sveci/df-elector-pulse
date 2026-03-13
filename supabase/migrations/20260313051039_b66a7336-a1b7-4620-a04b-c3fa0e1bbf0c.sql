
CREATE TABLE IF NOT EXISTS public.whatsapp_chatbot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT (public.get_default_tenant_id()) REFERENCES public.tenants(id),
  first_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  registration_state TEXT DEFAULT NULL,
  collected_name TEXT DEFAULT NULL,
  collected_email TEXT DEFAULT NULL,
  collected_city TEXT DEFAULT NULL,
  registration_asked_at TIMESTAMPTZ DEFAULT NULL,
  registration_completed_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(phone, tenant_id)
);

ALTER TABLE public.whatsapp_chatbot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_chatbot_sessions"
  ON public.whatsapp_chatbot_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Auth users view sessions for their tenants"
  ON public.whatsapp_chatbot_sessions
  FOR SELECT
  TO authenticated
  USING (tenant_id = ANY(public.get_user_tenant_ids(auth.uid())));
