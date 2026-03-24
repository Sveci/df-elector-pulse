-- Optimize: sync_event_registration_contact to also save localidade
CREATE OR REPLACE FUNCTION public.sync_event_registration_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  normalized_phone text;
  existing_contact_id uuid;
BEGIN
  -- Normalize phone number to E.164 format
  normalized_phone := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');
  IF length(normalized_phone) = 11 THEN
    normalized_phone := '+55' || normalized_phone;
  ELSIF length(normalized_phone) = 10 THEN
    normalized_phone := '+55' || normalized_phone;
  ELSIF length(normalized_phone) = 13 AND normalized_phone LIKE '55%' THEN
    normalized_phone := '+' || normalized_phone;
  ELSIF length(normalized_phone) > 0 AND normalized_phone NOT LIKE '+%' THEN
    normalized_phone := '+' || normalized_phone;
  END IF;

  -- Check if contact already exists by phone AND tenant
  SELECT id INTO existing_contact_id
  FROM office_contacts
  WHERE telefone_norm = normalized_phone
    AND tenant_id = NEW.tenant_id
  LIMIT 1;

  IF existing_contact_id IS NOT NULL THEN
    UPDATE office_contacts SET
      nome = COALESCE(NULLIF(nome, ''), NEW.nome),
      email = COALESCE(NULLIF(email, ''), NEW.email),
      cidade_id = COALESCE(cidade_id, NEW.cidade_id),
      localidade = COALESCE(NULLIF(localidade, ''), NEW.localidade),
      data_nascimento = COALESCE(data_nascimento, NEW.data_nascimento),
      endereco = COALESCE(NULLIF(endereco, ''), NEW.endereco),
      updated_at = now()
    WHERE id = existing_contact_id;
    
    NEW.contact_id := existing_contact_id;
  ELSE
    INSERT INTO office_contacts (
      nome, email, telefone_norm, cidade_id, localidade, source_type, source_id,
      data_nascimento, endereco, tenant_id
    )
    VALUES (
      NEW.nome, NEW.email, normalized_phone, NEW.cidade_id, NEW.localidade,
      'evento', NEW.id,
      NEW.data_nascimento, NEW.endereco, NEW.tenant_id
    )
    RETURNING id INTO existing_contact_id;
    
    NEW.contact_id := existing_contact_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Optimize score_event_registration: use telefone_norm index instead of normalize_phone_e164 function calls
CREATE OR REPLACE FUNCTION public.score_event_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _registrant_leader_id UUID;
  _contact_verified BOOLEAN;
  _limite_eventos_dia INTEGER;
  _eventos_hoje INTEGER;
  _should_score_leader BOOLEAN := true;
  _normalized_phone text;
BEGIN
  -- Pre-normalize phone once
  _normalized_phone := regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g');
  IF length(_normalized_phone) = 11 OR length(_normalized_phone) = 10 THEN
    _normalized_phone := '+55' || _normalized_phone;
  ELSIF length(_normalized_phone) = 13 AND _normalized_phone LIKE '55%' THEN
    _normalized_phone := '+' || _normalized_phone;
  ELSIF length(_normalized_phone) > 0 AND _normalized_phone NOT LIKE '+%' THEN
    _normalized_phone := '+' || _normalized_phone;
  END IF;

  -- Buscar configuração de limite
  SELECT COALESCE(limite_eventos_dia, 0) INTO _limite_eventos_dia
  FROM office_settings WHERE tenant_id = NEW.tenant_id LIMIT 1;
  
  -- Se foi indicado por um líder via link de afiliado
  IF NEW.leader_id IS NOT NULL THEN
    IF _limite_eventos_dia > 0 THEN
      SELECT COUNT(*) INTO _eventos_hoje
      FROM event_registrations
      WHERE leader_id = NEW.leader_id
        AND DATE(created_at) = CURRENT_DATE
        AND id != NEW.id;
      
      IF _eventos_hoje >= _limite_eventos_dia THEN
        _should_score_leader := false;
      END IF;
    END IF;
    
    IF _should_score_leader THEN
      SELECT is_verified INTO _contact_verified
      FROM office_contacts
      WHERE id = NEW.contact_id;
      
      IF _contact_verified = true OR NEW.contact_id IS NULL THEN
        PERFORM award_leader_points(NEW.leader_id, 1, 'indicacao_evento');
        PERFORM increment_leader_cadastros(NEW.leader_id);
      END IF;
    END IF;
  END IF;
  
  -- Verificar se o inscrito é um líder usando telefone normalizado (indexed)
  SELECT id INTO _registrant_leader_id
  FROM lideres
  WHERE is_active = true
    AND tenant_id = NEW.tenant_id
    AND (
      telefone = _normalized_phone
      OR (email IS NOT NULL AND email = NEW.email)
    )
  LIMIT 1;
  
  IF _registrant_leader_id IS NOT NULL THEN
    IF _limite_eventos_dia > 0 THEN
      SELECT COUNT(*) INTO _eventos_hoje
      FROM event_registrations er
      WHERE er.event_id = NEW.event_id
        AND DATE(er.created_at) = CURRENT_DATE
        AND er.id != NEW.id
        AND (er.whatsapp = NEW.whatsapp OR er.email = NEW.email);
      
      IF _eventos_hoje >= _limite_eventos_dia THEN
        RETURN NEW;
      END IF;
    END IF;
    
    PERFORM award_leader_points(_registrant_leader_id, 1, 'lider_inscricao_evento');
  END IF;
  
  RETURN NEW;
END;
$function$;