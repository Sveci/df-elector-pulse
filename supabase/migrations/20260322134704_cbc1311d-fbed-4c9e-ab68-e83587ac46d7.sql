CREATE OR REPLACE FUNCTION sync_event_registration_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      data_nascimento = COALESCE(data_nascimento, NEW.data_nascimento),
      endereco = COALESCE(NULLIF(endereco, ''), NEW.endereco),
      updated_at = now()
    WHERE id = existing_contact_id;
    
    NEW.contact_id := existing_contact_id;
  ELSE
    INSERT INTO office_contacts (
      nome, email, telefone_norm, cidade_id, source_type, source_id,
      data_nascimento, endereco, tenant_id
    )
    VALUES (
      NEW.nome, NEW.email, normalized_phone, NEW.cidade_id, 
      'evento', NEW.id,
      NEW.data_nascimento, NEW.endereco, NEW.tenant_id
    )
    RETURNING id INTO existing_contact_id;
    
    NEW.contact_id := existing_contact_id;
  END IF;

  RETURN NEW;
END;
$$;