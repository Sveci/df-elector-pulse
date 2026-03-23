
CREATE TABLE public.whatsapp_chatbot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT ((auth.jwt() -> 'user_metadata' ->> 'tenant_id')::text),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  tags text[] NOT NULL DEFAULT '{}',
  color text,
  icon text,
  trigger_count integer NOT NULL DEFAULT 0,
  execution_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

ALTER TABLE public.whatsapp_chatbot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read flows for their tenant"
ON public.whatsapp_chatbot_flows
FOR SELECT
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Auth users insert flows for their tenant"
ON public.whatsapp_chatbot_flows
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Auth users update flows for their tenant"
ON public.whatsapp_chatbot_flows
FOR UPDATE
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
)
WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Auth users delete flows for their tenant"
ON public.whatsapp_chatbot_flows
FOR DELETE
TO authenticated
USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
);

CREATE OR REPLACE FUNCTION public.update_chatbot_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chatbot_flows_updated_at
  BEFORE UPDATE ON public.whatsapp_chatbot_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chatbot_flows_updated_at();
