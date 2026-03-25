-- Drop the OLD overload that has _data_nascimento as DATE and no _localidade parameter
DROP FUNCTION IF EXISTS public.create_event_registration(
  _event_id uuid,
  _nome text,
  _email text,
  _whatsapp text,
  _cidade_id uuid,
  _leader_id uuid,
  _utm_source text,
  _utm_medium text,
  _utm_campaign text,
  _utm_content text,
  _data_nascimento date,
  _endereco text
);