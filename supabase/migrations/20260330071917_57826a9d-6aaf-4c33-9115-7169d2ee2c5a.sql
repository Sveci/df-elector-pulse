CREATE OR REPLACE FUNCTION public.get_recent_whatsapp_phones(hours_ago int DEFAULT 24)
RETURNS TABLE(phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT wm.phone
  FROM whatsapp_messages wm
  WHERE wm.direction = 'incoming'
    AND wm.created_at >= NOW() - (hours_ago || ' hours')::interval;
$$;