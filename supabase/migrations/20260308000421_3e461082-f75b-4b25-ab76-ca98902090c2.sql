CREATE OR REPLACE FUNCTION public.read_secret(secret_name text)
RETURNS TABLE(id uuid, name text, secret text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, decrypted_secret as secret
  FROM vault.decrypted_secrets s
  WHERE s.name = secret_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_secret(secret_name text, new_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE vault.secrets
  SET secret = new_secret, updated_at = now()
  WHERE name = secret_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_secret(name text, secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO vault.secrets (name, secret)
  VALUES (insert_secret.name, insert_secret.secret)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;