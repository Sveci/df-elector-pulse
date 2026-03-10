import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";

export interface AppSettings {
  id: string;
  tenant_id: string;
  facebook_pixel_id: string | null;
  facebook_api_token: string | null;
  facebook_pixel_code: string | null;
  gtm_id: string | null;
  affiliate_form_cover_url: string | null;
  affiliate_form_logo_url: string | null;
  leader_form_cover_url: string | null;
  leader_form_logo_url: string | null;
  leader_form_title: string | null;
  leader_form_subtitle: string | null;
  created_at: string;
  updated_at: string;
}

export function useAppSettings() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["app_settings", tenantId],
    queryFn: async () => {
      let query = supabase
        .from("app_settings")
        .select("*");

      if (tenantId) query = query.eq("tenant_id", tenantId);

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) throw error;

      // Auto-create settings for this tenant if none exist
      if (!data && tenantId) {
        const { data: newData, error: insertError } = await supabase
          .from("app_settings")
          .insert({ tenant_id: tenantId })
          .select()
          .single();

        if (insertError) throw insertError;
        return newData as AppSettings;
      }

      return data as AppSettings;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: !!tenantId,
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async (updates: Partial<AppSettings>) => {
      let query = supabase
        .from("app_settings")
        .select("id");

      if (tenantId) query = query.eq("tenant_id", tenantId);

      const { data: existing } = await query.limit(1).single();

      if (!existing) {
        throw new Error("Configurações não encontradas");
      }

      const { data, error } = await supabase
        .from("app_settings")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar configurações: " + error.message);
    },
  });
}
