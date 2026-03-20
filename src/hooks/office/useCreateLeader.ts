import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLeader } from "@/services/office/officeService";
import { toast } from "@/hooks/use-toast";
import { useSendLeaderVerificationSMS } from "@/hooks/leaders/useLeaderVerification";
import type { CreateLeaderDTO } from "@/types/office";

export function useCreateLeader() {
  const queryClient = useQueryClient();
  const { mutateAsync: sendVerificationSMS } = useSendLeaderVerificationSMS();

  return useMutation({
    mutationFn: async (data: CreateLeaderDTO) => {
      // 1. Criar o líder com verification_code e affiliate_token
      const leader = await createLeader(data);

      // 2. Se tem telefone, enviar SMS de verificação
      if (leader.telefone && leader.verification_code) {
        try {
          await sendVerificationSMS({
            leaderId: leader.id,
            leaderName: leader.nome_completo,
            leaderPhone: leader.telefone,
            verificationCode: leader.verification_code,
          });
        } catch (err) {
          console.error("Erro ao enviar SMS de verificação:", err);
          // Não bloquear cadastro se SMS falhar
        }
      }

      return leader;
    },
    onSuccess: (leader) => {
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      toast({
        title: "Líder cadastrado",
        description: leader.telefone
          ? "O líder foi adicionado. SMS de verificação enviado."
          : "O líder foi adicionado (sem telefone para verificação).",
      });
    },
    onError: (error: any) => {
      const message = error?.message || "Erro ao cadastrar líder";
      toast({
        title: "Erro",
        description: message,
        variant: "destructive",
      });
    },
  });
}
