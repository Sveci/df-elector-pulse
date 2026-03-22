CREATE POLICY "Auth users delete sessions for their tenants"
ON public.whatsapp_chatbot_sessions
FOR DELETE
TO authenticated
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
  )
);