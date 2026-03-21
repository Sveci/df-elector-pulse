-- Ensure functions that use gen_random_bytes can resolve pgcrypto in Lovable Cloud
ALTER FUNCTION public.create_event_registration(uuid, text, text, text, uuid, uuid, text, text, text, text)
SET search_path = public, extensions;

ALTER FUNCTION public.create_event_registration(uuid, text, text, text, uuid, uuid, text, text, text, text, date)
SET search_path = public, extensions;

ALTER FUNCTION public.create_event_registration(uuid, text, text, text, uuid, uuid, text, text, text, text, date, text)
SET search_path = public, extensions;

ALTER FUNCTION public.create_event_registration(uuid, text, text, text, text, text, text, uuid, text, text, text, text)
SET search_path = public, extensions;

ALTER FUNCTION public.create_leader_from_public_form(text, text, text, uuid, date, text, text)
SET search_path = public, extensions;

ALTER FUNCTION public.create_leader_from_public_form(text, text, text, uuid, date, uuid)
SET search_path = public, extensions;