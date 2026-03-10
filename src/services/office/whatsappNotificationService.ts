import { supabase } from "@/integrations/supabase/client";
import { generateVisitFormUrl } from "@/lib/urlHelper";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// =====================================================
// WHATSAPP NOTIFICATION SERVICE
// Serviço para disparos automáticos via templates
// =====================================================

interface VisitData {
  id: string;
  protocolo: string;
  contact: {
    nome: string;
    telefone_norm: string;
  };
  rescheduled_date?: string | null;
}

/**
 * Busca o nome do deputado/organização
 */
async function getDeputadoNome(): Promise<string> {
  const { data } = await supabase
    .from("organization")
    .select("nome, cargo")
    .limit(1)
    .single();
  
  if (data?.cargo && data?.nome) {
    return `${data.cargo} ${data.nome}`;
  }
  return data?.nome || "Gabinete";
}

/**
 * Envia WhatsApp usando template via edge function
 */
async function sendWhatsAppTemplate(
  phone: string,
  templateSlug: string,
  variables: Record<string, string>,
  visitId?: string,
  contactId?: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: {
        phone,
        templateSlug,
        variables,
        visitId,
        contactId,
        tenantId
      }
    });

    if (error) {
      console.error(`[WhatsApp] Erro ao enviar template ${templateSlug}:`, error);
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? false, error: data?.error };
  } catch (err) {
    console.error(`[WhatsApp] Exceção ao enviar template ${templateSlug}:`, err);
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

/**
 * Envia link do formulário quando visita é criada
 * Template: visita-link-formulario
 */
export async function sendVisitFormLink(visit: VisitData): Promise<{ success: boolean; error?: string }> {
  const formLink = generateVisitFormUrl(visit.id);
  
  const variables = {
    nome: visit.contact.nome,
    protocolo: visit.protocolo,
    form_link: formLink
  };

  console.log(`[WhatsApp] Enviando link do formulário para ${visit.contact.nome}`);
  
  return sendWhatsAppTemplate(
    visit.contact.telefone_norm,
    "visita-link-formulario",
    variables,
    visit.id
  );
}

/**
 * Envia notificação quando reunião é cancelada
 * Template: visita-reuniao-cancelada
 */
export async function sendMeetingCancelledNotification(visit: VisitData): Promise<{ success: boolean; error?: string }> {
  const deputadoNome = await getDeputadoNome();
  
  const variables = {
    nome: visit.contact.nome,
    protocolo: visit.protocolo,
    deputado_nome: deputadoNome
  };

  console.log(`[WhatsApp] Enviando notificação de cancelamento para ${visit.contact.nome}`);
  
  return sendWhatsAppTemplate(
    visit.contact.telefone_norm,
    "visita-reuniao-cancelada",
    variables,
    visit.id
  );
}

/**
 * Envia notificação quando reunião é reagendada
 * Template: visita-reuniao-reagendada
 */
export async function sendMeetingRescheduledNotification(
  visit: VisitData,
  newDate: Date
): Promise<{ success: boolean; error?: string }> {
  const deputadoNome = await getDeputadoNome();
  const formattedDate = format(newDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  
  const variables = {
    nome: visit.contact.nome,
    protocolo: visit.protocolo,
    nova_data: formattedDate,
    deputado_nome: deputadoNome
  };

  console.log(`[WhatsApp] Enviando notificação de reagendamento para ${visit.contact.nome}`);
  
  return sendWhatsAppTemplate(
    visit.contact.telefone_norm,
    "visita-reuniao-reagendada",
    variables,
    visit.id
  );
}

/**
 * Busca dados da visita para envio de notificação
 */
export async function getVisitForNotification(visitId: string): Promise<VisitData | null> {
  const { data, error } = await supabase
    .from("office_visits")
    .select(`
      id,
      protocolo,
      rescheduled_date,
      contact:office_contacts(nome, telefone_norm)
    `)
    .eq("id", visitId)
    .single();

  if (error || !data) {
    console.error("[WhatsApp] Erro ao buscar visita:", error);
    return null;
  }

  return {
    id: data.id,
    protocolo: data.protocolo,
    rescheduled_date: data.rescheduled_date,
    contact: {
      nome: (data.contact as any)?.nome || "",
      telefone_norm: (data.contact as any)?.telefone_norm || ""
    }
  };
}
