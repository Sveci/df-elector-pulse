
-- Function to get the current user's default tenant
CREATE OR REPLACE FUNCTION public.get_default_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM user_tenants
  WHERE user_id = auth.uid()
  AND is_default = true
  LIMIT 1
$$;

-- Add DEFAULT to all tenant_id columns so TypeScript types make it optional
DO $$
DECLARE
  _tables text[] := ARRAY[
    'office_contacts', 'lideres', 'events', 'event_registrations',
    'office_cities', 'temas', 'campaigns', 'lead_funnels',
    'office_visits', 'office_visit_forms', 'office_meeting_minutes',
    'app_settings', 'integrations_settings', 'office_settings', 'organization',
    'contact_activity_log', 'contact_downloads', 'contact_page_views', 'contact_verifications',
    'coordinator_credentials', 'email_logs', 'email_templates', 'event_photo_links',
    'campaign_materials', 'material_reservations', 'material_withdrawals',
    'whatsapp_messages', 'whatsapp_templates',
    'whatsapp_chatbot_config', 'whatsapp_chatbot_keywords', 'whatsapp_chatbot_logs',
    'sms_messages', 'sms_templates', 'scheduled_messages', 'short_urls',
    'surveys', 'survey_questions', 'survey_responses', 'survey_analyses',
    'po_collection_configs', 'po_daily_snapshots', 'po_events', 'po_insights',
    'po_mentions', 'po_monitored_entities', 'po_sentiment_analyses', 'po_strategic_analyses',
    'map_analyses', 'programas', 'region_materials', 'regiao_administrativa',
    'page_views', 'perfil_demografico', 'system_notifications'
  ];
  _t text;
BEGIN
  FOREACH _t IN ARRAY _tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = _t AND column_name = 'tenant_id') THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT get_default_tenant_id()', _t);
    END IF;
  END LOOP;
END $$;
