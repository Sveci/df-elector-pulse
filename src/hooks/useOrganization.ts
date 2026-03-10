import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantContext } from "@/contexts/TenantContext";
import { useTenantId } from "@/hooks/useTenantId";

interface Organization {
  id: string;
  nome: string;
  nome_plataforma: string | null;
  cargo: string | null;
  partido: string | null;
  estado: string | null;
  cidade: string | null;
  bio: string | null;
  logo_url: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  youtube: string | null;
  whatsapp: string | null;
  email_contato: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Returns organization data, merging tenant political config (cargo/estado/cidade)
 * from the active tenant with the organization table data.
 */
export function useOrganization() {
  let activeTenant: any = null;
  try {
    const ctx = useTenantContext();
    activeTenant = ctx.activeTenant;
  } catch {
    // Outside TenantProvider, fallback to null
  }

  return useQuery({
    queryKey: ["organization", activeTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization")
        .select("*")
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;

      // Merge tenant political config into organization data
      const org = (data as Organization | null) || {} as Partial<Organization>;
      
      if (activeTenant) {
        return {
          ...org,
          cargo: activeTenant.cargo_politico || org.cargo || null,
          estado: activeTenant.estado || org.estado || null,
          cidade: activeTenant.cidade || org.cidade || null,
        } as Organization;
      }

      return (data as Organization | null);
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<Organization>) => {
      // First get the existing organization
      const { data: existing } = await supabase
        .from("organization")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from("organization")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("organization")
          .insert(updates)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Organização atualizada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar organização:", error);
      toast.error("Erro ao atualizar organização");
    },
  });
}

export async function uploadOrganizationLogo(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `organization-logo-${Date.now()}.${fileExt}`;
  const filePath = `logos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
