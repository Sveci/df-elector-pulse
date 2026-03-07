
-- Tabela de Tenants
CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  email_contato text,
  telefone text,
  logo_url text,
  plano text NOT NULL DEFAULT 'basic',
  status text NOT NULL DEFAULT 'active',
  max_usuarios integer DEFAULT 5,
  max_contatos integer DEFAULT 10000,
  max_lideres integer DEFAULT 500,
  data_expiracao timestamp with time zone,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Apenas super_admin pode gerenciar tenants
CREATE POLICY "super_admin_manage_tenants"
  ON public.tenants FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Usuários autenticados podem ver tenants (para a modal de seleção)
CREATE POLICY "authenticated_select_tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (status = 'active');

-- Tabela de associação usuário-tenant
CREATE TABLE public.user_tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias associações
CREATE POLICY "users_select_own_tenants"
  ON public.user_tenants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Super admin pode gerenciar todas as associações
CREATE POLICY "super_admin_manage_user_tenants"
  ON public.user_tenants FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
