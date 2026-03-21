-- Fix ALL overloads of create_event_registration to include tenant_id from the event

-- Overload 1: 10 args (original simple version)
CREATE OR REPLACE FUNCTION public.create_event_registration(
  _event_id uuid, _nome text, _email text, _whatsapp text,
  _cidade_id uuid DEFAULT NULL, _leader_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL, _utm_content text DEFAULT NULL
)
RETURNS TABLE(id uuid, qr_code text, checked_in boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    utm_source, utm_medium, utm_campaign, utm_content, tenant_id
  ) VALUES (
    _event_id, _nome, _email, _whatsapp, _cidade_id, _leader_id,
    _utm_source, _utm_medium, _utm_campaign, _utm_content, _tenant_id
  ) RETURNING event_registrations.id, event_registrations.qr_code 
  INTO _registration_id, _registration_qr_code;

  RETURN QUERY SELECT _registration_id, _registration_qr_code, false;
END;
$function$;

-- Overload 2: 11 args (with _data_nascimento date)
CREATE OR REPLACE FUNCTION public.create_event_registration(
  _event_id uuid, _nome text, _email text, _whatsapp text,
  _cidade_id uuid DEFAULT NULL, _leader_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL, _utm_content text DEFAULT NULL,
  _data_nascimento date DEFAULT NULL
)
RETURNS TABLE(id uuid, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _new_id uuid;
  _created_at timestamptz;
  _tenant_id uuid;
BEGIN
  SELECT e.tenant_id INTO _tenant_id FROM events e WHERE e.id = _event_id;

  INSERT INTO event_registrations (
    event_id, nome, email, whatsapp, cidade_id, leader_id,
    utm_source, utm_medium, utm_campaign, utm_content, data_nascimento, tenant_id
  ) VALUES (
    _event_id, _nome, _email, _whatsapp, _cidade_id, _leader_id,
    _utm_source, _utm_medium, _utm_campaign, _utm_content, _data_nascimento, _tenant_id
  ) RETURNING event_registrations.id, event_registrations.created_at INTO _new_id, _created_at;
  
  RETURN QUERY SELECT _new_id, _created_at;
END;
$function$;

-- Overload 3: 12 args with _endereco, _data_nascimento text, _leader_token
CREATE OR REPLACE FUNCTION public.create_event_registration(
  _event_id uuid, _nome text, _email text, _whatsapp text,
  _endereco text DEFAULT NULL, _data_nascimento text DEFAULT NULL,
  _leader_token text DEFAULT NULL, _cidade_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL, _utm_content text DEFAULT NULL
)
RETURNS TABLE(registration_id uuid, qr_code text, is_new boolean, contact_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  _leader_id uuid := NULL;
  _contact_id uuid := NULL;
  _registration_id uuid;
  _qr_code text;
  _is_new boolean := false;
  _event_datetime timestamp with time zone;
  _deadline timestamp with time zone;
  _deadline_hours integer;
  _tenant_id uuid;
BEGIN
  SELECT 
    (e.date || ' ' || e.time)::timestamp with time zone,
    e.registration_deadline_hours,
    e.tenant_id
  INTO _event_datetime, _deadline_hours, _tenant_id
  FROM events e WHERE e.id = _event_id AND e.status = 'active';

  IF _event_datetime IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado ou inativo.';
  END IF;

  IF _deadline_hours IS NOT NULL THEN
    _deadline := _event_datetime - (_deadline_hours || ' hours')::interval;
    IF now() > _deadline THEN
      RAISE EXCEPTION 'O prazo para inscrições neste evento foi encerrado.';
    END IF;
  END IF;

  IF _leader_token IS NOT NULL AND _leader_token != '' THEN
    SELECT l.id INTO _leader_id FROM lideres l WHERE l.affiliate_token = _leader_token AND l.is_active = true;
  END IF;

  SELECT er.id, er.qr_code INTO _registration_id, _qr_code
  FROM event_registrations er
  WHERE er.event_id = _event_id AND (er.email = _email OR er.whatsapp = _whatsapp)
  LIMIT 1;

  IF _registration_id IS NOT NULL THEN
    RETURN QUERY SELECT _registration_id, _qr_code, false, _contact_id;
    RETURN;
  END IF;

  _qr_code := encode(gen_random_bytes(16), 'hex');

  INSERT INTO event_registrations (
    event_id, nome, email, whatsapp, endereco, data_nascimento,
    leader_id, cidade_id, qr_code,
    utm_source, utm_medium, utm_campaign, utm_content, tenant_id
  ) VALUES (
    _event_id, _nome, _email, _whatsapp, _endereco, _data_nascimento,
    _leader_id, _cidade_id, _qr_code,
    _utm_source, _utm_medium, _utm_campaign, _utm_content, _tenant_id
  ) RETURNING event_registrations.id INTO _registration_id;

  _is_new := true;
  RETURN QUERY SELECT _registration_id, _qr_code, _is_new, _contact_id;
END;
$function$;

-- Overload 4: 12 args with _leader_id uuid, _data_nascimento date, _endereco text
CREATE OR REPLACE FUNCTION public.create_event_registration(
  _event_id uuid, _nome text, _email text, _whatsapp text,
  _cidade_id uuid DEFAULT NULL, _leader_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL, _utm_content text DEFAULT NULL,
  _data_nascimento date DEFAULT NULL, _endereco text DEFAULT NULL
)
RETURNS TABLE(id uuid, created_at timestamptz, qr_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _new_id uuid;
  _created_at timestamptz;
  _new_qr_code text;
  _tenant_id uuid;
BEGIN
  SELECT e.tenant_id INTO _tenant_id FROM events e WHERE e.id = _event_id;

  _new_qr_code := encode(gen_random_bytes(16), 'hex');

  INSERT INTO event_registrations (
    event_id, nome, email, whatsapp, cidade_id, leader_id,
    utm_source, utm_medium, utm_campaign, utm_content,
    data_nascimento, endereco, qr_code, tenant_id
  ) VALUES (
    _event_id, _nome, _email, _whatsapp, _cidade_id, _leader_id,
    _utm_source, _utm_medium, _utm_campaign, _utm_content,
    _data_nascimento, _endereco, _new_qr_code, _tenant_id
  ) RETURNING event_registrations.id, event_registrations.created_at, event_registrations.qr_code
  INTO _new_id, _created_at, _new_qr_code;
  
  RETURN QUERY SELECT _new_id, _created_at, _new_qr_code;
END;
$function$;