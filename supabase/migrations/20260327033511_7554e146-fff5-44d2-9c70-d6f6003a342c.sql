
-- Allow authenticated users to INSERT/UPDATE/DELETE on brain_cache (tenant-scoped)
CREATE POLICY "brain_cache_tenant_insert" ON public.brain_cache FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "brain_cache_tenant_update" ON public.brain_cache FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "brain_cache_tenant_delete" ON public.brain_cache FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
