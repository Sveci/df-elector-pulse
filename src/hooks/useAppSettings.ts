import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AppSettings {
  id: string;
  facebook_pixel_id: string | null;
  facebook_api_token: string | null;
  facebook_pixel_code: string | null;
  gtm_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as AppSettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

export function useUpdateAppSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<AppSettings>) => {
      // Get the first (and only) settings record
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .limit(1)
        .single();

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
