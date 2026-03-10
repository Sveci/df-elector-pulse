import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppCommunity {
  id: string;
  tenant_id: string;
  municipio: string;
  numero_lista: number;
  community_link: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppCommunities() {
  return useQuery({
    queryKey: ["whatsapp-communities"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_communities")
        .select("*")
        .order("numero_lista");

      if (error) throw error;
      return data as WhatsAppCommunity[];
    },
  });
}

export function useUpdateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WhatsAppCommunity> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_communities")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-communities"] });
      toast.success("Comunidade atualizada!");
    },
    onError: () => {
      toast.error("Erro ao atualizar comunidade");
    },
  });
}

export function useWhatsAppChatStates() {
  return useQuery({
    queryKey: ["whatsapp-chat-states"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_chat_state")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Array<{
        id: string;
        phone: string;
        state: string;
        municipio: string | null;
        created_at: string;
        updated_at: string;
      }>;
    },
  });
}
