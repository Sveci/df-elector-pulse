ALTER TABLE public.po_collection_jobs 
  ADD COLUMN IF NOT EXISTS mentions_analyzed integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_total integer DEFAULT 0;