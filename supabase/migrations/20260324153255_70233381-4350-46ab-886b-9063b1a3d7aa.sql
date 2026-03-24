-- Drop both overloads and recreate a single one with text parameter
DROP FUNCTION IF EXISTS public.create_event_registration(uuid, text, text, text, uuid, uuid, text, text, text, text, date, text, text);
DROP FUNCTION IF EXISTS public.create_event_registration(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_event_registration(
  _event_id uuid,
  _nome text,
  _email text,
  _whatsapp text,
  _cidade_id uuid DEFAULT NULL,
  _leader_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _data_nascimento text DEFAULT NULL,
  _endereco text DEFAULT NULL,
  _localidade text DEFAULT NULL
)
RETURNS TABLE(id uuid, created_at timestamptz, qr_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _new_id uuid;
  _created_at timestamptz;
  _qr text;
BEGIN
  SELECT tenant_id INTO _tenant_id FROM events WHERE events.id = _event_id;
  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  _new_id := gen_random_uuid();
  _created_at := now();
  _qr := encode(extensions.digest(_new_id::text, 'sha256'), 'hex');

  INSERT INTO event_registrations (
    id, event_id, nome, email, whatsapp, cidade_id, leader_id,
    utm_source, utm_medium, utm_campaign, utm_content, tenant_id,
    localidade, data_nascimento, endereco, qr_code, created_at
  ) VALUES (
    _new_id, _event_id, _nome, _email, _whatsapp, _cidade_id, _leader_id,
    _utm_source, _utm_medium, _utm_campaign, _utm_content, _tenant_id,
    _localidade,
    CASE WHEN _data_nascimento IS NOT NULL AND _data_nascimento != '' THEN _data_nascimento::date ELSE NULL END,
    _endereco, _qr, _created_at
  );

  RETURN QUERY SELECT _new_id, _created_at, _qr;
END;
$$;