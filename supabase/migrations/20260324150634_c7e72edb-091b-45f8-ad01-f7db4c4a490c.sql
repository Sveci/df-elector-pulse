
-- Fix public_create_leader_self_registration to resolve tenant_id without auth context
-- Both overloads need fixing

-- Overload with p_localidade (7 args)
CREATE OR REPLACE FUNCTION public.public_create_leader_self_registration(
  p_nome text, p_telefone text, p_email text DEFAULT NULL,
  p_cidade_id uuid DEFAULT NULL, p_data_nascimento date DEFAULT NULL,
  p_observacao text DEFAULT NULL, p_localidade text DEFAULT NULL
)
RETURNS TABLE(leader_id uuid, verification_code text, already_exists boolean, is_verified boolean, error_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_by_phone RECORD;
  v_existing_by_email RECORD;
  v_new_leader_id uuid;
  v_verification_code text;
  v_tenant_id uuid;
BEGIN
  -- Resolve tenant_id: try auth user first, then fallback to first tenant
  v_tenant_id := (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_default = true LIMIT 1);
  IF v_tenant_id IS NULL THEN
    v_tenant_id := (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);
  END IF;
  
  IF v_tenant_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, false, 'Nenhuma organização configurada'::text;
    RETURN;
  END IF;

  -- Check existing by phone (within tenant)
  SELECT l.id, COALESCE(l.is_verified, false) as is_verified, l.verification_code
  INTO v_existing_by_phone
  FROM lideres l
  WHERE l.is_active = true AND l.telefone = p_telefone AND l.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_existing_by_phone.id IS NOT NULL THEN
    IF v_existing_by_phone.verification_code IS NULL THEN
      v_verification_code := generate_leader_verification_code();
      UPDATE lideres SET verification_code = v_verification_code, updated_at = now()
      WHERE id = v_existing_by_phone.id;
    ELSE
      v_verification_code := v_existing_by_phone.verification_code;
    END IF;

    RETURN QUERY SELECT
      v_existing_by_phone.id,
      v_verification_code,
      true::boolean,
      v_existing_by_phone.is_verified::boolean,
      NULL::text;
    RETURN;
  END IF;

  -- Check existing by email (within tenant)
  IF p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    SELECT l.id, l.nome_completo
    INTO v_existing_by_email
    FROM lideres l
    WHERE l.is_active = true AND LOWER(l.email) = LOWER(btrim(p_email)) AND l.tenant_id = v_tenant_id
    LIMIT 1;

    IF v_existing_by_email.id IS NOT NULL THEN
      RETURN QUERY SELECT
        NULL::uuid, NULL::text, true::boolean, false::boolean,
        ('Email já cadastrado para o apoiador: ' || v_existing_by_email.nome_completo)::text;
      RETURN;
    END IF;
  END IF;

  v_verification_code := generate_leader_verification_code();

  INSERT INTO lideres (
    nome_completo, telefone, email, cidade_id, localidade,
    data_nascimento, observacao, is_active, status, cadastros,
    pontuacao_total, is_verified, verification_code, tenant_id
  ) VALUES (
    p_nome, p_telefone, NULLIF(btrim(p_email), ''), p_cidade_id, p_localidade,
    p_data_nascimento, NULLIF(btrim(p_observacao), ''), true, 'active', 0,
    0, false, v_verification_code, v_tenant_id
  ) RETURNING id INTO v_new_leader_id;

  RETURN QUERY SELECT
    v_new_leader_id,
    v_verification_code,
    false::boolean,
    false::boolean,
    NULL::text;
END;
$function$;

-- Overload without p_localidade (6 args)
CREATE OR REPLACE FUNCTION public.public_create_leader_self_registration(
  p_nome text, p_telefone text, p_email text DEFAULT NULL,
  p_cidade_id uuid DEFAULT NULL, p_data_nascimento date DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS TABLE(leader_id uuid, verification_code text, already_exists boolean, is_verified boolean, error_message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_by_phone RECORD;
  v_existing_by_email RECORD;
  v_new_leader_id uuid;
  v_verification_code text;
  v_tenant_id uuid;
BEGIN
  -- Resolve tenant_id
  v_tenant_id := (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_default = true LIMIT 1);
  IF v_tenant_id IS NULL THEN
    v_tenant_id := (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);
  END IF;
  
  IF v_tenant_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false, false, 'Nenhuma organização configurada'::text;
    RETURN;
  END IF;

  SELECT l.id, COALESCE(l.is_verified, false) as is_verified, l.verification_code
  INTO v_existing_by_phone
  FROM lideres l
  WHERE l.is_active = true AND l.telefone = p_telefone AND l.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_existing_by_phone.id IS NOT NULL THEN
    IF v_existing_by_phone.verification_code IS NULL THEN
      v_verification_code := generate_leader_verification_code();
      UPDATE lideres SET verification_code = v_verification_code, updated_at = now()
      WHERE id = v_existing_by_phone.id;
    ELSE
      v_verification_code := v_existing_by_phone.verification_code;
    END IF;

    RETURN QUERY SELECT
      v_existing_by_phone.id,
      v_verification_code,
      true::boolean,
      v_existing_by_phone.is_verified::boolean,
      NULL::text;
    RETURN;
  END IF;

  IF p_email IS NOT NULL AND btrim(p_email) <> '' THEN
    SELECT l.id, l.nome_completo
    INTO v_existing_by_email
    FROM lideres l
    WHERE l.is_active = true AND LOWER(l.email) = LOWER(btrim(p_email)) AND l.tenant_id = v_tenant_id
    LIMIT 1;

    IF v_existing_by_email.id IS NOT NULL THEN
      RETURN QUERY SELECT
        NULL::uuid, NULL::text, true::boolean, false::boolean,
        ('Email já cadastrado para o apoiador: ' || v_existing_by_email.nome_completo)::text;
      RETURN;
    END IF;
  END IF;

  v_verification_code := generate_leader_verification_code();

  INSERT INTO lideres (
    nome_completo, telefone, email, cidade_id,
    data_nascimento, observacao, is_active, status, cadastros,
    pontuacao_total, is_verified, verification_code, tenant_id
  ) VALUES (
    p_nome, p_telefone, NULLIF(btrim(p_email), ''), p_cidade_id,
    p_data_nascimento, NULLIF(btrim(p_observacao), ''), true, 'active', 0,
    0, false, v_verification_code, v_tenant_id
  ) RETURNING id INTO v_new_leader_id;

  RETURN QUERY SELECT
    v_new_leader_id,
    v_verification_code,
    false::boolean,
    false::boolean,
    NULL::text;
END;
$function$;
