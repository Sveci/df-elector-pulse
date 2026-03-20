import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantId } from "@/hooks/useTenantId";
import { generateLeaderVerificationUrl, generateLeaderReferralUrl } from "@/lib/urlHelper";

// Enviar SMS de verificação para novo líder
export function useSendLeaderVerificationSMS() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async ({
      leaderId,
      leaderName,
      leaderPhone,
      verificationCode,
    }: {
      leaderId: string;
      leaderName: string;
      leaderPhone: string;
      verificationCode: string;
    }) => {
      // SEMPRE usa URL de produção (via função dedicada)
      const verificationLink = generateLeaderVerificationUrl(verificationCode);

      // Enviar SMS de verificação
      const { error: smsError } = await supabase.functions.invoke("send-sms", {
        body: {
          phone: leaderPhone,
          templateSlug: "verificacao-lider-sms",
          variables: {
            nome: leaderName,
            link_verificacao: verificationLink,
          },
        },
      });

      if (smsError) {
        console.error("Erro ao enviar SMS de verificação:", smsError);
        throw smsError;
      }

      // Atualizar verification_sent_at
      await supabase.rpc("update_leader_verification_sent", {
        _leader_id: leaderId,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      toast.success("SMS de verificação enviado com sucesso!");
    },
    onError: (error: any) => {
      console.error("Erro ao enviar verificação:", error);
      toast.error("Erro ao enviar SMS de verificação");
    },
  });
}

// Reenviar SMS de verificação para líder existente
export function useResendLeaderVerificationSMS() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaderId: string) => {
      // Buscar dados do líder
      const { data: leader, error: leaderError } = await supabase
        .from("lideres")
        .select("id, nome_completo, telefone, verification_code")
        .eq("id", leaderId)
        .single();

      if (leaderError) throw leaderError;
      if (!leader) throw new Error("Líder não encontrado");
      if (!leader.telefone) throw new Error("Líder não possui telefone cadastrado");
      if (!leader.verification_code) throw new Error("Líder não possui código de verificação");

      // SEMPRE usa URL de produção (via função dedicada)
      const verificationLink = generateLeaderVerificationUrl(leader.verification_code);

      // Enviar SMS de verificação
      const { error: smsError } = await supabase.functions.invoke("send-sms", {
        body: {
          phone: leader.telefone,
          templateSlug: "verificacao-lider-sms",
          variables: {
            nome: leader.nome_completo,
            link_verificacao: verificationLink,
          },
        },
      });

      if (smsError) throw smsError;

      // Atualizar verification_sent_at
      await supabase.rpc("update_leader_verification_sent", {
        _leader_id: leaderId,
      });

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      toast.success("SMS de verificação reenviado!");
    },
    onError: (error: any) => {
      console.error("Erro ao reenviar verificação:", error);
      toast.error(error?.message || "Erro ao reenviar SMS de verificação");
    },
  });
}

// Marcar líder como verificado manualmente
export function useMarkLeaderVerifiedManually() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leaderId: string) => {
      // Buscar o usuário logado para registrar quem verificou
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc("mark_leader_verified_manually", {
        _leader_id: leaderId,
        _verified_by: user?.id || null,
      });

      if (error) throw error;

      // Após verificação bem-sucedida, chamar edge function para enviar links de afiliado
      console.log("[useMarkLeaderVerifiedManually] Calling send-leader-affiliate-links for leader:", leaderId);

      const { error: sendError } = await supabase.functions.invoke("send-leader-affiliate-links", {
        body: { leader_id: leaderId },
      });

      if (sendError) {
        console.error("[useMarkLeaderVerifiedManually] Error sending affiliate links:", sendError);
        // Não lançar erro aqui - a verificação foi bem-sucedida, apenas o envio falhou
        // O usuário pode reenviar manualmente depois
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaders"] });
      queryClient.invalidateQueries({ queryKey: ["office_leaders"] });
      toast.success("Líder marcado como verificado!");
    },
    onError: (error: any) => {
      console.error("Erro ao verificar manualmente:", error);
      toast.error("Erro ao marcar líder como verificado");
    },
  });
}

// Enviar link de afiliado após verificação
export function useSendLeaderAffiliateLink() {
  const tenantId = useTenantId();
  return useMutation({
    mutationFn: async ({
      leaderId,
      leaderName,
      leaderPhone,
      leaderEmail,
      affiliateToken,
      customDomain,
    }: {
      leaderId: string;
      leaderName: string;
      leaderPhone: string;
      leaderEmail?: string | null;
      affiliateToken: string;
      customDomain?: string | null;
    }) => {
      // Usa domínio customizado do tenant quando disponível
      const affiliateLink = generateLeaderReferralUrl(affiliateToken, customDomain);

      // Gerar QR Code
      const QRCode = (await import("qrcode")).default;
      const qrCodeDataUrl = await QRCode.toDataURL(affiliateLink, { width: 300 });

      // Enviar WhatsApp com QR code
      await supabase.functions.invoke("send-whatsapp", {
        body: {
          phone: leaderPhone,
          templateSlug: "lideranca-cadastro-link",
          variables: {
            nome: leaderName,
            link_cadastro_afiliado: affiliateLink,
          },
          imageUrl: qrCodeDataUrl,
          tenantId,
        },
      });

      // Enviar SMS com link
      await supabase.functions.invoke("send-sms", {
        body: {
          phone: leaderPhone,
          templateSlug: "lider-cadastro-confirmado-sms",
          variables: {
            nome: leaderName,
            link_indicacao: affiliateLink,
          },
        },
      });

      // Enviar email de boas-vindas (se tiver email)
      if (leaderEmail) {
        await supabase.functions.invoke("send-email", {
          body: {
            to: leaderEmail,
            toName: leaderName,
            templateSlug: "lideranca-boas-vindas",
            variables: {
              nome: leaderName,
              link_indicacao: affiliateLink,
            },
          },
        });
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success("Link de afiliado enviado com sucesso!");
    },
    onError: (error: any) => {
      console.error("Erro ao enviar link de afiliado:", error);
      toast.error("Erro ao enviar link de afiliado");
    },
  });
}
