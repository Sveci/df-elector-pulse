import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateVerificationUrl } from "@/lib/urlHelper";

interface SendVerificationParams {
  contactId: string;
  contactName: string;
  contactPhone: string;
  leaderName: string;
  verificationCode: string;
}

interface SendVerificationSMSParams {
  contactId: string;
  contactName: string;
  contactPhone: string;
  verificationCode: string;
}

/**
 * Envia SMS com link de verificação para o contato
 * Esta é a forma principal de verificação para cadastros via link de líder
 */
export async function sendVerificationSMS({
  contactId,
  contactName,
  contactPhone,
  verificationCode,
}: SendVerificationSMSParams): Promise<boolean> {
  try {
    console.log("Sending verification SMS to:", contactPhone);

    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: {
        phone: contactPhone,
        templateSlug: "verificacao-link-sms",
        variables: {
          nome: contactName,
          link_verificacao: generateVerificationUrl(verificationCode),
        },
        contactId: contactId,
      },
    });

    if (error) {
      console.error("Error sending verification SMS:", error);
      return false;
    }

    // Verificar se a resposta indica sucesso
    if (!data?.success) {
      console.error("SMS send failed:", data?.error || data);
      return false;
    }

    // SÓ atualiza verification_sent_at se o SMS foi enviado com sucesso
    await supabase.rpc('update_contact_verification_sent', {
      _contact_id: contactId
    });

    console.log("Verification SMS sent successfully:", data);
    return true;
  } catch (err) {
    console.error("Error in sendVerificationSMS:", err);
    return false;
  }
}

export async function sendVerificationMessage({
  contactId,
  contactName,
  contactPhone,
  leaderName,
  verificationCode,
}: SendVerificationParams): Promise<boolean> {
  try {
    // Get organization name
    const { data: org } = await supabase
      .from("organization")
      .select("nome")
      .limit(1)
      .single();

    // Enviar mensagem principal usando templateSlug (permite envio público sem autenticação)
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        phone: contactPhone,
        templateSlug: "verificacao-cadastro",
        variables: {
          nome: contactName,
          lider_nome: leaderName,
          deputado_nome: org?.nome || "Deputado",
        },
        contactId: contactId,
        bypassAutoCheck: true,
      },
    });

    if (error) {
      console.error("Error sending verification message:", error);
      return false;
    }

    // Aguardar 2 segundos antes de enviar o código
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enviar código em mensagem separada (facilita copiar no WhatsApp)
    // Usar templateSlug especial ou message direta - para código, precisamos de um template público
    const { error: codeError } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        phone: contactPhone,
        templateSlug: "verificacao-codigo",
        variables: {
          codigo: verificationCode,
        },
        contactId: contactId,
        bypassAutoCheck: true,
      },
    });

    if (codeError) {
      console.error("Error sending verification code:", codeError);
      // Não retorna false pois a mensagem principal foi enviada
    }

    // Update verification_sent_at via SECURITY DEFINER function
    await supabase.rpc('update_contact_verification_sent', {
      _contact_id: contactId
    });

    console.log("Verification message sent:", data);
    return true;
  } catch (err) {
    console.error("Error in sendVerificationMessage:", err);
    return false;
  }
}

export async function resendVerificationCode(contactId: string): Promise<boolean> {
  try {
    // Get contact data
    const { data: contact, error } = await supabase
      .from("office_contacts")
      .select(`
        id,
        nome,
        telefone_norm,
        verification_code,
        source_id,
        source_type
      `)
      .eq("id", contactId)
      .single();

    if (error || !contact) {
      toast.error("Contato não encontrado");
      return false;
    }

    if (contact.source_type !== "lider" || !contact.source_id) {
      toast.error("Este contato não requer verificação");
      return false;
    }

    // Get leader name
    const { data: leader } = await supabase
      .from("lideres")
      .select("nome_completo")
      .eq("id", contact.source_id)
      .single();

    if (!leader) {
      toast.error("Líder não encontrado");
      return false;
    }

    // Generate new code if needed
    let verificationCode = contact.verification_code;
    if (!verificationCode) {
      const { data: newCode } = await supabase.rpc("generate_verification_code");
      verificationCode = newCode;

      await supabase
        .from("office_contacts")
        .update({ verification_code: verificationCode })
        .eq("id", contactId);
    }

    const success = await sendVerificationMessage({
      contactId: contact.id,
      contactName: contact.nome,
      contactPhone: contact.telefone_norm,
      leaderName: leader.nome_completo,
      verificationCode: verificationCode,
    });

    if (success) {
      toast.success("Código de verificação reenviado!");
    } else {
      toast.error("Erro ao reenviar código");
    }

    return success;
  } catch (err) {
    console.error("Error resending verification:", err);
    toast.error("Erro ao reenviar verificação");
    return false;
  }
}

/**
 * Reenvia SMS de verificação para um contato
 */
export async function resendVerificationSMS(contactId: string): Promise<boolean> {
  try {
    // Get contact data
    const { data: contact, error } = await supabase
      .from("office_contacts")
      .select(`
        id,
        nome,
        telefone_norm,
        verification_code,
        source_id,
        source_type
      `)
      .eq("id", contactId)
      .single();

    if (error || !contact) {
      toast.error("Contato não encontrado");
      return false;
    }

    if (contact.source_type !== "lider" || !contact.source_id) {
      toast.error("Este contato não requer verificação");
      return false;
    }

    // Generate new code if needed
    let verificationCode = contact.verification_code;
    if (!verificationCode) {
      const { data: newCode } = await supabase.rpc("generate_verification_code");
      verificationCode = newCode;

      await supabase
        .from("office_contacts")
        .update({ verification_code: verificationCode })
        .eq("id", contactId);
    }

    const success = await sendVerificationSMS({
      contactId: contact.id,
      contactName: contact.nome,
      contactPhone: contact.telefone_norm,
      verificationCode: verificationCode,
    });

    if (success) {
      toast.success("SMS de verificação reenviado!");
    } else {
      toast.error("Erro ao reenviar SMS");
    }

    return success;
  } catch (err) {
    console.error("Error resending verification SMS:", err);
    toast.error("Erro ao reenviar verificação");
    return false;
  }
}

interface PendingMessage {
  template: string;
  variables: Record<string, string>;
  created_at: string;
}

export function addPendingMessage(
  existingPending: unknown,
  template: string,
  variables: Record<string, string>
): Record<string, unknown>[] {
  const existing = Array.isArray(existingPending) ? existingPending : [];
  return [
    ...existing,
    {
      template,
      variables,
      created_at: new Date().toISOString(),
    },
  ];
}
