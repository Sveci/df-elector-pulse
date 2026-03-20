import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UpdateContactData {
  cidade_id?: string;
  source_id?: string | null;
  source_type?: string | null;
  genero?: string;
  data_nascimento?: string | null;
}

export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateContactData }) => {
      console.log("Updating contact:", id, data);

      const { data: contact, error } = await supabase
        .from('office_contacts')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      queryClient.invalidateQueries({ queryKey: ["leaders_ranking"] });
      toast({
        title: "✅ Contato atualizado",
        description: "As informações foram salvas com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Erro ao atualizar contato:", error);
      toast({
        title: "❌ Erro ao atualizar",
        description: error.message || "Não foi possível salvar as alterações",
        variant: "destructive",
      });
    },
  });
}
