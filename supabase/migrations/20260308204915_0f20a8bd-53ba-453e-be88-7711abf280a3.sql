
-- Function to lookup tenant by custom_domain (for public pages)
CREATE OR REPLACE FUNCTION public.get_tenant_by_domain(_domain text)
RETURNS TABLE(
  id uuid,
  nome text,
  slug text,
  custom_domain text,
  logo_url text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.nome, t.slug, t.custom_domain, t.logo_url, t.status
  FROM public.tenants t
  WHERE t.custom_domain IS NOT NULL
    AND t.status = 'active'
    AND (
      t.custom_domain = _domain
      OR t.custom_domain = 'https://' || _domain
      OR t.custom_domain = 'http://' || _domain
      OR replace(replace(t.custom_domain, 'https://', ''), 'http://', '') = _domain
    )
  LIMIT 1;
$$;
