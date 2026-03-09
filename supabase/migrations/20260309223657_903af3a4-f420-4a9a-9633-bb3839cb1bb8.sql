
-- Table to cache IBGE cities per state
CREATE TABLE public.ibge_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ibge_id integer NOT NULL,
  nome text NOT NULL,
  uf text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ibge_id)
);

-- Table to cache IBGE districts per city
CREATE TABLE public.ibge_distritos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ibge_id integer NOT NULL,
  nome text NOT NULL,
  cidade_ibge_id integer NOT NULL,
  cidade_nome text NOT NULL,
  uf text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(ibge_id)
);

-- Enable RLS
ALTER TABLE public.ibge_cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibge_distritos ENABLE ROW LEVEL SECURITY;

-- Public read access (used on public forms)
CREATE POLICY "ibge_cidades_select_public" ON public.ibge_cidades FOR SELECT USING (true);
CREATE POLICY "ibge_distritos_select_public" ON public.ibge_distritos FOR SELECT USING (true);

-- Admin/service insert/update/delete
CREATE POLICY "ibge_cidades_modify_admin" ON public.ibge_cidades FOR ALL TO authenticated
  USING (has_admin_access(auth.uid()))
  WITH CHECK (has_admin_access(auth.uid()));

CREATE POLICY "ibge_distritos_modify_admin" ON public.ibge_distritos FOR ALL TO authenticated
  USING (has_admin_access(auth.uid()))
  WITH CHECK (has_admin_access(auth.uid()));

-- Allow service role inserts (for edge function)
CREATE POLICY "ibge_cidades_insert_service" ON public.ibge_cidades FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "ibge_distritos_insert_service" ON public.ibge_distritos FOR INSERT TO anon WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_ibge_cidades_uf ON public.ibge_cidades(uf);
CREATE INDEX idx_ibge_distritos_uf_cidade ON public.ibge_distritos(uf, cidade_ibge_id);
