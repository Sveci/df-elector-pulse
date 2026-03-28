
-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Event registrations viewable by admins" ON public.event_registrations;

-- Create new SELECT policy that includes checkin_operator
CREATE POLICY "Event registrations viewable by authorized users"
ON public.event_registrations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin', 'checkin_operator')
  )
);
