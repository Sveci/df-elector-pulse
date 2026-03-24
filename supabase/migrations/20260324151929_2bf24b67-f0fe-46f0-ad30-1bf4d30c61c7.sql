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
RETURNS TABLE(id uuid, qr_code text, checked_in boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _registration_id uuid;
  _registration_qr_code text;
  _event_datetime timestamp with time zone;
  _deadline timestamp with time zone;
  _tenant_id uuid;
BEGIN
  SELECT (e.date + e.time)::timestamp with time zone, e.tenant_id
  INTO _event_datetime, _tenant_id
  FROM events e WHERE e.id = _event_id AND e.status = 'active';
  
  IF _event_datetime IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado ou não está ativo.';
  END IF;
  
  _deadline := _event_datetime + interval '4 hours';
  IF now() > _deadline THEN
    RAISE EXCEPTION 'O prazo para inscrições neste evento foi encerrado.';
  END IF;

  IF EXISTS (SELECT 1 FROM event_registrations WHERE event_id = _event_id AND email = _email) THEN
    RAISE EXCEPTION 'Você já está inscrito neste evento!';
  END IF;

  INSERT INTO event_registrations (
    event_id, nome, email, whatsapp, cidade_id, leader_id,
    utm_source, utm_medium, utm_campaign, utm_content, tenant_id,
    localidade, data_nascimento, endereco
  ) VALUES (
    _event_id, _nome, _email, _whatsapp, _cidade_id, _leader_id,
    _utm_source, _utm_medium, _utm_campaign, _utm_content, _tenant_id,
    _localidade, CASE WHEN _data_nascimento IS NOT NULL AND _data_nascimento != '' THEN _data_nascimento::date ELSE NULL END, _endereco
  ) RETURNING event_registrations.id, event_registrations.qr_code 
  INTO _registration_id, _registration_qr_code;

  RETURN QUERY SELECT _registration_id, _registration_qr_code, false;
END;
$$;