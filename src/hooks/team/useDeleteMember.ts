import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      console.log('[useDeleteMember] Excluindo usuário:', userId);

      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) {
        console.error('[useDeleteMember] Erro:', error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Membro excluído com sucesso!");
    },
    onError: (error: any) => {
      console.error("[useDeleteMember] Erro ao excluir membro:", error);
      toast.error("Erro ao excluir membro: " + (error.message || "Tente novamente"));
    },
  });
}
