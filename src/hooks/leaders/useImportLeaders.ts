import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface LeaderImportData {
  nome_completo: string;
  whatsapp: string;
  data_nascimento?: string;
  status?: string;
  observacao?: string;
  email?: string;
}

interface ImportResult {
  success: boolean;
  inserted: number;
  updated: number;
  errors: Array<{ line: number; error: string; data?: any }>;
  total: number;
}

export function useImportLeaders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaders: LeaderImportData[]): Promise<ImportResult> => {
      const { data, error } = await supabase.functions.invoke('import-leaders', {
        body: { leaders },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao importar líderes');
      }

      return data as ImportResult;
    },
    onSuccess: (result) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });

      // Mostrar resultado
      const successMsg = `${result.inserted} líder(es) criado(s), ${result.updated} atualizado(s)`;

      if (result.errors.length > 0) {
        toast({
          title: "Importação concluída com erros",
          description: `${successMsg}. ${result.errors.length} linha(s) com erro.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Importação concluída",
          description: successMsg,
        });
      }
    },
    onError: (error: any) => {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: error?.message || "Erro ao importar líderes",
        variant: "destructive",
      });
    },
  });
}
