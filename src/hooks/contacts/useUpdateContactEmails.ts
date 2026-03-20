import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ContactEmailUpdate {
  nome: string;
  email: string;
  whatsapp: string;
}

interface UpdateEmailsResult {
  success: boolean;
  updated: number;
  notFound: Array<{
    line: number;
    reason: string;
    nome: string;
    whatsapp: string;
  }>;
}

export function useUpdateContactEmails() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: ContactEmailUpdate[]): Promise<UpdateEmailsResult> => {
      const { data, error } = await supabase.functions.invoke('update-contact-emails', {
        body: { contacts },
      });

      if (error) throw error;
      return data as UpdateEmailsResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-email-count'] });

      if (result.success) {
        toast({
          title: "✅ Atualização concluída",
          description: `${result.updated} e-mails atualizados. ${result.notFound.length} não encontrados.`,
        });
      } else {
        toast({
          title: "⚠️ Atualização concluída com avisos",
          description: `${result.updated} atualizados, ${result.notFound.length} não encontrados.`,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      const message = error?.message || "Erro ao atualizar e-mails";
      toast({
        title: "❌ Erro na atualização",
        description: message,
        variant: "destructive",
      });
    },
  });
}
