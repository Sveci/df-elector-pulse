CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'greatpages',
  method text,
  content_type text,
  headers jsonb,
  raw_payload jsonb,
  raw_text text,
  ip_address text,
  user_agent text,
  response_status int,
  response_body jsonb,
  processing_result text,
  contact_id uuid,
  leader_id uuid,
  tenant_id text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read webhook_logs"
  ON public.webhook_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_source ON public.webhook_logs(source);