import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { UpdateLeaderDTO } from "@/types/office";

export function useUpdateLeader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateLeaderDTO }) => {
      const updateData: any = {
        nome_completo: data.nome_completo,
        email: data.email || null,
        telefone: data.telefone || null,
        cidade_id: data.cidade_id || null,
        localidade: data.localidade || null,
        data_nascimento: data.data_nascimento || null,
        observacao: data.observacao || null,
        instagram_username: data.instagram_username || null,
        is_active: data.is_active,
        status: data.is_active ? 'active' : 'inactive',
      };

      const { data: leader, error } = await supabase
        .from('lideres')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return leader;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      toast({
        title: "Sucesso",
        description: "Líder atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      console.error('Erro ao atualizar líder:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao atualizar líder",
        variant: "destructive",
      });
    },
  });
}
