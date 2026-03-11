
CREATE TABLE public.po_collection_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.po_monitored_entities(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT (auth.jwt() ->> 'tenant_id')::uuid,
  status text NOT NULL DEFAULT 'running',
  sources_requested text[] NOT NULL DEFAULT '{}',
  sources_completed text[] NOT NULL DEFAULT '{}',
  source_current text,
  mentions_found integer NOT NULL DEFAULT 0,
  mentions_inserted integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  progress_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.po_collection_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant jobs"
  ON public.po_collection_jobs FOR SELECT TO authenticated
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

ALTER PUBLICATION supabase_realtime ADD TABLE public.po_collection_jobs;
