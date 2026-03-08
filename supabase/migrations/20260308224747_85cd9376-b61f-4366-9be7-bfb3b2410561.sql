
-- Create tenant_email_templates table for per-tenant overrides
CREATE TABLE public.tenant_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  slug text NOT NULL,
  nome text NOT NULL,
  assunto text NOT NULL,
  conteudo_html text NOT NULL,
  categoria text NOT NULL,
  variaveis jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.tenant_email_templates ENABLE ROW LEVEL SECURITY;

-- RLS: admins and super_admins can manage
CREATE POLICY "tenant_email_templates_modify"
  ON public.tenant_email_templates
  FOR ALL
  TO authenticated
  USING (has_admin_access(auth.uid()))
  WITH CHECK (has_admin_access(auth.uid()));

-- RLS: select for admins
CREATE POLICY "tenant_email_templates_select"
  ON public.tenant_email_templates
  FOR SELECT
  TO authenticated
  USING (has_admin_access(auth.uid()));

-- Add unique constraint on email_templates.slug if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_templates_slug_key'
  ) THEN
    -- First delete duplicates keeping the newest
    DELETE FROM public.email_templates a
    USING public.email_templates b
    WHERE a.slug = b.slug AND a.created_at < b.created_at;
    
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_slug_key UNIQUE (slug);
  END IF;
END $$;
