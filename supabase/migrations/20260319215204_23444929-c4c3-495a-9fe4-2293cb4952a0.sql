
-- 1. Add Instagram verification columns to office_visit_forms
ALTER TABLE public.office_visit_forms 
  ADD COLUMN IF NOT EXISTS segue_instagram boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_check_status text DEFAULT 'pending';

-- 2. Add short_url column to office_visits
ALTER TABLE public.office_visits 
  ADD COLUMN IF NOT EXISTS short_url text;

-- 3. Add photo columns to office_meeting_minutes
ALTER TABLE public.office_meeting_minutes
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_transcription text;

-- 4. Create office_meeting_upload_tokens table
CREATE TABLE IF NOT EXISTS public.office_meeting_upload_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.office_visits(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  used_at timestamptz,
  tenant_id uuid NOT NULL DEFAULT get_default_tenant_id() REFERENCES public.tenants(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_meeting_upload_tokens ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can manage tokens for their tenant
CREATE POLICY "Users can manage meeting upload tokens"
  ON public.office_meeting_upload_tokens
  FOR ALL
  TO authenticated
  USING (tenant_id = ANY(get_user_tenant_ids(auth.uid())))
  WITH CHECK (tenant_id = ANY(get_user_tenant_ids(auth.uid())));

-- RLS: public can read tokens (for the upload page)
CREATE POLICY "Public can read valid tokens"
  ON public.office_meeting_upload_tokens
  FOR SELECT
  TO anon
  USING (true);

-- 5. Create meeting-photos storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('meeting-photos', 'meeting-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload meeting photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meeting-photos');

-- Storage RLS: anon can upload (for public upload page)
CREATE POLICY "Anon can upload meeting photos"
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'meeting-photos');

-- Storage RLS: anyone can read meeting photos
CREATE POLICY "Anyone can read meeting photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'meeting-photos');
