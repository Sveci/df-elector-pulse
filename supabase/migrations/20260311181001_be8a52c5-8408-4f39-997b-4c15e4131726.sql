
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Knowledge Base Documents
CREATE TABLE public.kb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT (public.get_default_tenant_id()) REFERENCES public.tenants(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'processing',
  total_chunks INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Knowledge Base Chunks (processed text fragments for RAG)
CREATE TABLE public.kb_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT (public.get_default_tenant_id()) REFERENCES public.tenants(id),
  document_id UUID NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_kb_documents_tenant ON public.kb_documents(tenant_id);
CREATE INDEX idx_kb_documents_category ON public.kb_documents(category);
CREATE INDEX idx_kb_documents_status ON public.kb_documents(status);
CREATE INDEX idx_kb_chunks_document ON public.kb_chunks(document_id);
CREATE INDEX idx_kb_chunks_tenant ON public.kb_chunks(tenant_id);
CREATE INDEX idx_kb_chunks_content_trgm ON public.kb_chunks USING gin (content gin_trgm_ops);

-- Enable RLS
ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "kb_documents_select" ON public.kb_documents FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));
CREATE POLICY "kb_documents_insert" ON public.kb_documents FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));
CREATE POLICY "kb_documents_update" ON public.kb_documents FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));
CREATE POLICY "kb_documents_delete" ON public.kb_documents FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));

CREATE POLICY "kb_chunks_select" ON public.kb_chunks FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));
CREATE POLICY "kb_chunks_insert" ON public.kb_chunks FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));
CREATE POLICY "kb_chunks_delete" ON public.kb_chunks FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT ut.tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid()));

CREATE POLICY "kb_documents_service_all" ON public.kb_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "kb_chunks_service_all" ON public.kb_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);
