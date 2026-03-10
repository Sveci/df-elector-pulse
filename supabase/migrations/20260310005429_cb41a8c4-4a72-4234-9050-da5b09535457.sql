
-- Helper function to get user's tenant IDs
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(tenant_id), '{}')
  FROM user_tenants
  WHERE user_id = _user_id
$$;

-- Add tenant_id to all business tables
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
  _default_tid uuid;
BEGIN
  SELECT id INTO _default_tid FROM tenants ORDER BY created_at ASC LIMIT 1;
  IF _default_tid IS NULL THEN
    RAISE EXCEPTION 'No tenants found';
  END IF;

  FOREACH _t IN ARRAY _tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = _t) THEN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = _t AND column_name = 'tenant_id') THEN
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid', _t);
        EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', _t, _default_tid);
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', _t);
        EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id)', _t, _t || '_tenant_id_fkey');
        EXECUTE format('CREATE INDEX %I ON public.%I (tenant_id)', 'idx_' || _t || '_tenant_id', _t);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Add tenant isolation RLS policies
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
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = _t) THEN
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I', _t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_policy ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (tenant_id = ANY(get_user_tenant_ids(auth.uid()))) WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())))',
        _t
      );
    END IF;
  END LOOP;
END $$;

-- Update RPCs for tenant filtering

CREATE OR REPLACE FUNCTION public.get_distinct_cities_count(_tenant_id uuid DEFAULT NULL)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT location_name) FROM (
    SELECT c.nome as location_name
    FROM office_contacts oc
    JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL AND (_tenant_id IS NULL OR oc.tenant_id = _tenant_id)
    UNION
    SELECT oc.localidade as location_name
    FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL AND (_tenant_id IS NULL OR oc.tenant_id = _tenant_id)
    UNION
    SELECT c.nome as location_name
    FROM lideres l
    JOIN office_cities c ON c.id = l.cidade_id
    WHERE l.cidade_id IS NOT NULL AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
    UNION
    SELECT l.localidade as location_name
    FROM lideres l
    WHERE l.localidade IS NOT NULL AND l.localidade != '' AND l.cidade_id IS NULL AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
  ) combined;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_city(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(city_name text, city_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT location_name as city_name, COUNT(*) as city_count FROM (
    SELECT c.nome as location_name, oc.id
    FROM office_contacts oc JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL AND (_tenant_id IS NULL OR oc.tenant_id = _tenant_id)
    UNION ALL
    SELECT oc.localidade, oc.id FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL AND (_tenant_id IS NULL OR oc.tenant_id = _tenant_id)
    UNION ALL
    SELECT c.nome, l.id FROM lideres l JOIN office_cities c ON c.id = l.cidade_id
    WHERE l.cidade_id IS NOT NULL AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
    UNION ALL
    SELECT l.localidade, l.id FROM lideres l
    WHERE l.localidade IS NOT NULL AND l.localidade != '' AND l.cidade_id IS NULL AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
  ) combined
  GROUP BY location_name ORDER BY city_count DESC LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_cities_ranking(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(city_name text, city_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT location_name as city_name, COUNT(*) as city_count FROM (
    SELECT c.nome as location_name, oc.id
    FROM office_contacts oc JOIN office_cities c ON c.id = oc.cidade_id
    WHERE oc.cidade_id IS NOT NULL AND (_tenant_id IS NULL OR oc.tenant_id = _tenant_id)
    UNION ALL
    SELECT oc.localidade, oc.id FROM office_contacts oc
    WHERE oc.localidade IS NOT NULL AND oc.localidade != '' AND oc.cidade_id IS NULL AND (_tenant_id IS NULL OR oc.tenant_id = _tenant_id)
    UNION ALL
    SELECT c.nome, l.id FROM lideres l JOIN office_cities c ON c.id = l.cidade_id
    WHERE l.cidade_id IS NOT NULL AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
    UNION ALL
    SELECT l.localidade, l.id FROM lideres l
    WHERE l.localidade IS NOT NULL AND l.localidade != '' AND l.cidade_id IS NULL AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
  ) combined
  GROUP BY location_name ORDER BY city_count DESC LIMIT 10;
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_stats(_tenant_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'genero', (
      SELECT json_agg(json_build_object('label', g.genero_label, 'count', g.cnt))
      FROM (
        SELECT genero_label, SUM(cnt)::bigint as cnt FROM (
          SELECT COALESCE(genero, 'Não identificado') as genero_label, count(*) as cnt
          FROM office_contacts WHERE (_tenant_id IS NULL OR tenant_id = _tenant_id)
          GROUP BY COALESCE(genero, 'Não identificado')
          UNION ALL
          SELECT 'Não identificado', count(*) FROM lideres WHERE (_tenant_id IS NULL OR tenant_id = _tenant_id)
        ) combined GROUP BY genero_label
      ) g
    ),
    'total_contacts', (
      (SELECT count(*) FROM office_contacts WHERE (_tenant_id IS NULL OR tenant_id = _tenant_id)) +
      (SELECT count(*) FROM lideres WHERE (_tenant_id IS NULL OR tenant_id = _tenant_id))
    ),
    'idade_media', (
      SELECT COALESCE(round(avg(idade))::int, 0) FROM (
        SELECT EXTRACT(YEAR FROM age(now(), data_nascimento::date)) as idade
        FROM office_contacts WHERE data_nascimento IS NOT NULL AND data_nascimento::date < now()
          AND EXTRACT(YEAR FROM age(now(), data_nascimento::date)) BETWEEN 18 AND 100
          AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
        UNION ALL
        SELECT EXTRACT(YEAR FROM age(now(), data_nascimento::date)) as idade
        FROM lideres WHERE data_nascimento IS NOT NULL AND data_nascimento::date < now()
          AND EXTRACT(YEAR FROM age(now(), data_nascimento::date)) BETWEEN 18 AND 100
          AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
      ) ages
    ),
    'contacts_with_checkin', (
      SELECT count(DISTINCT er.contact_id) FROM event_registrations er
      WHERE er.checked_in = true AND er.contact_id IS NOT NULL
        AND (_tenant_id IS NULL OR er.tenant_id = _tenant_id)
    )
  );
$function$;

CREATE OR REPLACE FUNCTION public.get_top_leaders_with_indicacoes(_limit integer DEFAULT 10, _tenant_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, nome_completo text, telefone text, pontuacao_total integer, indicacoes integer, cidade_nome text, is_active boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT l.id, l.nome_completo, l.telefone, l.pontuacao_total,
    get_leader_total_indicacoes(l.id)::integer as indicacoes,
    COALESCE(c.nome, l.localidade, 'Não informada') as cidade_nome,
    l.is_active
  FROM lideres l LEFT JOIN office_cities c ON c.id = l.cidade_id
  WHERE l.is_active = true AND (_tenant_id IS NULL OR l.tenant_id = _tenant_id)
  ORDER BY l.pontuacao_total DESC LIMIT _limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_coordinators_cadastros_report(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, nome_completo text, cidade_nome text, total_cadastros bigint, verificados bigint, pendentes bigint)
LANGUAGE sql
STABLE
AS $function$
WITH RECURSIVE subordinates AS (
  SELECT coord.id as coordinator_id, sub.id as subordinate_id, sub.is_verified
  FROM lideres coord
  INNER JOIN lideres sub ON sub.parent_leader_id = coord.id
  WHERE coord.is_coordinator = true AND coord.is_active = true AND sub.is_active = true
    AND (_tenant_id IS NULL OR coord.tenant_id = _tenant_id)
    AND (_tenant_id IS NULL OR sub.tenant_id = _tenant_id)
  UNION ALL
  SELECT s.coordinator_id, sub.id, sub.is_verified
  FROM subordinates s
  INNER JOIN lideres sub ON sub.parent_leader_id = s.subordinate_id
  WHERE sub.is_active = true AND (_tenant_id IS NULL OR sub.tenant_id = _tenant_id)
)
SELECT coord.id, coord.nome_completo, c.nome as cidade_nome,
  COALESCE(stats.total, 0)::BIGINT, COALESCE(stats.verified, 0)::BIGINT,
  (COALESCE(stats.total, 0) - COALESCE(stats.verified, 0))::BIGINT
FROM lideres coord
LEFT JOIN office_cities c ON c.id = coord.cidade_id
LEFT JOIN (
  SELECT coordinator_id, COUNT(*)::BIGINT as total,
    SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END)::BIGINT as verified
  FROM subordinates GROUP BY coordinator_id
) stats ON stats.coordinator_id = coord.id
WHERE coord.is_coordinator = true AND coord.is_active = true
  AND (_tenant_id IS NULL OR coord.tenant_id = _tenant_id)
ORDER BY COALESCE(stats.total, 0) DESC;
$function$;
