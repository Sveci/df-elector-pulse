ALTER TABLE public.integrations_settings
  ADD COLUMN IF NOT EXISTS meta_cloud_phone_number_id_2 text,
  ADD COLUMN IF NOT EXISTS meta_cloud_waba_id_2 text,
  ADD COLUMN IF NOT EXISTS meta_cloud_phone_2 text,
  ADD COLUMN IF NOT EXISTS meta_cloud_enabled_2 boolean DEFAULT false;