
CREATE TABLE public.po_strategic_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis jsonb NOT NULL,
  comparison_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

ALTER TABLE public.po_strategic_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "po_strategic_analyses_select" ON public.po_strategic_analyses
  FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "po_strategic_analyses_insert" ON public.po_strategic_analyses
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "po_strategic_analyses_delete" ON public.po_strategic_analyses
  FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role));
