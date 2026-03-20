import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateLeaderVerificationUrl } from "@/lib/urlHelper";

interface PromoteToLeaderParams {
  contact: {
    id: string;
    nome: string;
    telefone_norm: string;
    email?: string | null;
    cidade_id?: string | null;
    localidade?: string | null;
    data_nascimento?: string | null;
  };
  actionBy: string;
}

export function usePromoteToLeader() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contact, actionBy }: PromoteToLeaderParams) => {
      // Usar a RPC SECURITY DEFINER que cria o líder
      const { data: result, error: rpcError } = await supabase
        .rpc('public_create_leader_self_registration', {
          p_nome: contact.nome,
          p_telefone: contact.telefone_norm,
          p_email: contact.email || null,
          p_cidade_id: contact.cidade_id || undefined,
          p_localidade: contact.localidade || undefined,
          p_data_nascimento: contact.data_nascimento || null,
          p_observacao: null,
        });

      if (rpcError) throw rpcError;

      const registrationResult = result?.[0] as {
        leader_id: string | null;
        verification_code: string | null;
        already_exists: boolean;
        is_verified: boolean;
        error_message: string | null;
      } | null;

      if (!registrationResult) {
        throw new Error("Erro ao processar promoção a líder");
      }

      // Verificar erro específico de email duplicado
      if (registrationResult.error_message) {
        throw new Error(registrationResult.error_message);
      }

      // Se já existe como líder (por telefone)
      if (registrationResult.already_exists) {
        throw new Error("Este contato já está cadastrado como apoiador");
      }

      const leaderId = registrationResult.leader_id;
      const verificationCode = registrationResult.verification_code;

      // Registrar no histórico
      const { error: logError } = await supabase
        .from("contact_activity_log")
        .insert({
          contact_id: contact.id,
          action: "promoted_to_leader",
          action_by: actionBy,
          details: {
            leader_id: leaderId,
            leader_name: contact.nome,
          },
        });

      if (logError) {
        console.error("Erro ao registrar histórico:", logError);
      }

      // Enviar SMS de VERIFICAÇÃO
      if (verificationCode) {
        try {
          // SEMPRE usa URL de produção (via função dedicada)
          const verificationLink = generateLeaderVerificationUrl(verificationCode);
          await supabase.functions.invoke("send-sms", {
            body: {
              phone: contact.telefone_norm,
              templateSlug: "verificacao-lider-sms",
              variables: {
                nome: contact.nome,
                link_verificacao: verificationLink,
              },
            },
          });

          // Atualizar verification_sent_at
          await supabase.rpc("update_leader_verification_sent", {
            _leader_id: leaderId,
          });

          console.log("SMS de verificação enviado para novo líder");
        } catch (smsError) {
          console.error("Erro ao enviar SMS de verificação:", smsError);
        }
      }

      // Enviar email informativo (sem link de afiliado, apenas confirmando cadastro)
      if (contact.email) {
        try {
          await supabase.functions.invoke("send-email", {
            body: {
              to: contact.email,
              toName: contact.nome,
              templateSlug: "lideranca-aguardando-verificacao",
              variables: {
                nome: contact.nome,
              },
            },
          });
          console.log("Email de confirmação de cadastro enviado");
        } catch (emailError) {
          console.error("Erro ao enviar email:", emailError);
        }
      }

      return { id: leaderId, nome_completo: contact.nome };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact_activity_log"] });
      toast({
        title: "Contato promovido",
        description: "O contato foi transformado em líder. SMS de verificação enviado.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Erro ao promover contato a líder",
        variant: "destructive",
      });
    },
  });
}
