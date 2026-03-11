
-- Drop incorrect policy
DROP POLICY "Users can view their tenant jobs" ON public.po_collection_jobs;

-- Create correct policy using the same pattern as other tables
CREATE POLICY "Users can view their tenant jobs"
  ON public.po_collection_jobs FOR SELECT TO authenticated
  USING (tenant_id = ANY (get_user_tenant_ids(auth.uid())));

-- Also fix the default for tenant_id since service role inserts with explicit tenant_id
ALTER TABLE public.po_collection_jobs ALTER COLUMN tenant_id DROP DEFAULT;
