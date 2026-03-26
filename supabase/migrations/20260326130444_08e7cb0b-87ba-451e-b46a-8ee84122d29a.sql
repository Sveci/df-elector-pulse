-- Drop the incorrectly scoped policy
DROP POLICY IF EXISTS "super_admin_manage_tenants" ON public.tenants;

-- Recreate with correct role target
CREATE POLICY "super_admin_manage_tenants"
ON public.tenants
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));