CREATE OR REPLACE FUNCTION public.upsert_contact_from_public_form(
  _nome text,
  _telefone_norm text,
  _email text DEFAULT NULL,
  _cidade_id uuid DEFAULT NULL,
  _localidade text DEFAULT NULL,
  _source_type text DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _utm_source text DEFAULT NULL,
  _utm_medium text DEFAULT NULL,
  _utm_campaign text DEFAULT NULL,
  _utm_content text DEFAULT NULL,
  _data_nascimento text DEFAULT NULL,
  _endereco text DEFAULT NULL,
  _facebook text DEFAULT NULL,
  _instagram text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contact_id UUID;
BEGIN
  SELECT id INTO _contact_id
  FROM office_contacts
  WHERE telefone_norm = _telefone_norm
  LIMIT 1;
  
  IF _contact_id IS NOT NULL THEN
    UPDATE office_contacts
    SET 
      email = COALESCE(_email, email),
      cidade_id = COALESCE(_cidade_id, cidade_id),
      localidade = COALESCE(_localidade, localidade),
      data_nascimento = COALESCE(_data_nascimento, data_nascimento),
      endereco = COALESCE(_endereco, endereco),
      facebook = COALESCE(_facebook, facebook),
      instagram = COALESCE(_instagram, instagram),
      updated_at = now()
    WHERE id = _contact_id;
  ELSE
    INSERT INTO office_contacts (
      nome, telefone_norm, email, cidade_id, localidade, source_type, source_id,
      utm_source, utm_medium, utm_campaign, utm_content,
      data_nascimento, endereco, facebook, instagram
    ) VALUES (
      _nome, _telefone_norm, _email, _cidade_id, _localidade, _source_type, _source_id,
      _utm_source, _utm_medium, _utm_campaign, _utm_content,
      _data_nascimento, _endereco, _facebook, _instagram
    )
    RETURNING id INTO _contact_id;
  END IF;
  
  RETURN _contact_id;
END;
$$;