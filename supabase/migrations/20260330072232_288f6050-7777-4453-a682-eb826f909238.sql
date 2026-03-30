CREATE OR REPLACE FUNCTION public.get_recent_whatsapp_phones_json(hours_ago int DEFAULT 24)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(t.phone),
    '[]'::jsonb
  )
  FROM (
    SELECT DISTINCT wm.phone
    FROM public.whatsapp_messages wm
    WHERE wm.direction = 'incoming'
      AND wm.created_at >= NOW() - make_interval(hours => hours_ago)
      AND wm.phone IS NOT NULL
      AND wm.phone <> ''
  ) t;
$$;