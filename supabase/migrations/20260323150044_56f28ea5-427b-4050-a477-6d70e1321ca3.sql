
DROP POLICY IF EXISTS "Auth users read flows for their tenant" ON public.whatsapp_chatbot_flows;
DROP POLICY IF EXISTS "Auth users insert flows for their tenant" ON public.whatsapp_chatbot_flows;
DROP POLICY IF EXISTS "Auth users update flows for their tenant" ON public.whatsapp_chatbot_flows;
DROP POLICY IF EXISTS "Auth users delete flows for their tenant" ON public.whatsapp_chatbot_flows;

ALTER TABLE public.whatsapp_chatbot_flows ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.whatsapp_chatbot_flows ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;

CREATE POLICY "Users read own tenant flows"
ON public.whatsapp_chatbot_flows FOR SELECT TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own tenant flows"
ON public.whatsapp_chatbot_flows FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users update own tenant flows"
ON public.whatsapp_chatbot_flows FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));

CREATE POLICY "Users delete own tenant flows"
ON public.whatsapp_chatbot_flows FOR DELETE TO authenticated
USING (tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid()));
