
-- Table for WhatsApp communities (one per municipality)
CREATE TABLE public.whatsapp_communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  municipio TEXT NOT NULL,
  numero_lista INTEGER NOT NULL,
  community_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, numero_lista),
  UNIQUE(tenant_id, municipio)
);

-- Table for WhatsApp conversation state
CREATE TABLE public.whatsapp_chat_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  phone TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'new',
  municipio TEXT,
  contact_id UUID REFERENCES public.office_contacts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, phone)
);

-- RLS
ALTER TABLE public.whatsapp_communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage communities" ON public.whatsapp_communities
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

ALTER TABLE public.whatsapp_chat_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view chat state" ON public.whatsapp_chat_state
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
