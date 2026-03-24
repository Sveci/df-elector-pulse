
-- Add a new overload of create_event_registration that includes _localidade
CREATE OR REPLACE FUNCTION public.create_event_registration(
  _event_id uuid, _nome text, _email text, _whatsapp text,
  _cidade_id uuid DEFAULT NULL, _leader_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL, _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL, _utm_content text DEFAULT NULL,
  _data_nascimento date DEFAULT NULL, _endereco text DEFAULT NULL,
  _localidade text DEFAULT NULL
)
RETURNS TABLE(id uuid, created_at timestamptz, qr_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _new_id uuid;
  _created_at timestamptz;
  _new_qr_code text;
  _tenant_id uuid;
  _event_date date;
  _event_time time;
  _deadline_hours int;
  _event_datetime timestamptz;
  _deadline_datetime timestamptz;
BEGIN
  -- Get event info
  SELECT e.tenant_id, e.date::date, e.time::time, COALESCE(e.registration_deadline_hours, 4)
  INTO _tenant_id, _event_date, _event_time, _deadline_hours
  FROM events e WHERE e.id = _event_id;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'Evento não encontrado';
  END IF;

  -- Check deadline
  _event_datetime := (_event_date + _event_time) AT TIME ZONE 'America/Sao_Paulo';
  _deadline_datetime := _event_datetime - (_deadline_hours || ' hours')::interval;

  IF now() > _event_datetime THEN
    RAISE EXCEPTION 'As inscrições para este evento estão encerradas.';
  END IF;

  -- Check duplicate
  IF EXISTS (
    SELECT 1 FROM event_registrations er
    WHERE er.event_id = _event_id AND er.whatsapp = _whatsapp
  ) THEN
    RAISE EXCEPTION 'Você já está inscrito neste evento com este número de WhatsApp.';
  END IF;

  _new_qr_code := encode(gen_random_bytes(16), 'hex');

  INSERT INTO event_registrations (
    event_id, nome, email, whatsapp, cidade_id, leader_id,
    utm_source, utm_medium, utm_campaign, utm_content,
    data_nascimento, endereco, localidade, qr_code, tenant_id
  ) VALUES (
    _event_id, _nome, _email, _whatsapp, _cidade_id, _leader_id,
    _utm_source, _utm_medium, _utm_campaign, _utm_content,
    _data_nascimento, _endereco, _localidade, _new_qr_code, _tenant_id
  ) RETURNING event_registrations.id, event_registrations.created_at, event_registrations.qr_code
  INTO _new_id, _created_at, _new_qr_code;
  
  RETURN QUERY SELECT _new_id, _created_at, _new_qr_code;
END;
$function$;
