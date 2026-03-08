
ALTER TABLE public.tenants 
  ADD COLUMN IF NOT EXISTS cargo_politico text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS regiao_administrativa_id uuid REFERENCES public.office_cities(id);
