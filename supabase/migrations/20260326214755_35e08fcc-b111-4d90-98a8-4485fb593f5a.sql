INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-media', 'whatsapp-media', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read whatsapp-media" ON storage.objects FOR SELECT TO public USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Auth users upload whatsapp-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'whatsapp-media');

CREATE POLICY "Auth users delete whatsapp-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'whatsapp-media');