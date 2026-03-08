import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  nome: string;
  slug: string;
  email_contato: string | null;
  telefone: string | null;
  logo_url: string | null;
  plano: string;
  status: string;
  max_usuarios: number | null;
  max_contatos: number | null;
  max_lideres: number | null;
  data_expiracao: string | null;
  observacoes: string | null;
  cargo_politico: string | null;
  estado: string | null;
  cidade: string | null;
  regiao_administrativa_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantData {
  nome: string;
  slug: string;
  email_contato?: string;
  telefone?: string;
  plano?: string;
  max_usuarios?: number;
  max_contatos?: number;
  max_lideres?: number;
  data_expiracao?: string;
  observacoes?: string;
  cargo_politico?: string;
  estado?: string;
  cidade?: string;
  regiao_administrativa_id?: string;
}

export function useTenants() {
  return useQuery({
    queryKey: ["tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Tenant[];
    },
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantData: CreateTenantData) => {
      const { data, error } = await supabase
        .from("tenants")
        .insert(tenantData)
        .select()
        .single();

      if (error) throw error;
      return data as Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Tenant> & { id: string }) => {
      const { data, error } = await supabase
        .from("tenants")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
  });
}

export function useUserTenants() {
  return useQuery({
    queryKey: ["user-tenants"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_tenants")
        .select("*, tenant:tenants(*)")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as Array<{
        id: string;
        user_id: string;
        tenant_id: string;
        role: string;
        is_default: boolean;
        tenant: Tenant;
      }>;
    },
  });
}
