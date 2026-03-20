import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VisitForNotification {
  id: string;
  protocolo: string;
  contact: {
    nome: string;
    telefone_norm: string;
  };
}

interface SendSMSResult {
  success: boolean;
  error?: string;
}

async function getOrganizationName(): Promise<string> {
  const { data } = await supabase
    .from("organization")
    .select("nome")
    .single();
  return data?.nome || "Gabinete";
}

export async function getVisitForSMSNotification(visitId: string): Promise<VisitForNotification | null> {
  const { data, error } = await supabase
    .from("office_visits")
    .select(`
      id,
      protocolo,
      contact:office_contacts(nome, telefone_norm)
    `)
    .eq("id", visitId)
    .single();

  if (error || !data) {
    console.error("[SMS] Erro ao buscar visita:", error);
    return null;
  }

  return data as unknown as VisitForNotification;
}

export async function sendMeetingCancelledSMS(visit: VisitForNotification): Promise<SendSMSResult> {
  try {
    const deputadoNome = await getOrganizationName();

    const { error } = await supabase.functions.invoke("send-sms", {
      body: {
        phone: visit.contact.telefone_norm,
        templateSlug: "visita-reuniao-cancelada",
        variables: {
          nome: visit.contact.nome,
          protocolo: visit.protocolo,
          deputado_nome: deputadoNome
        }
      }
    });

    if (error) {
      console.error("[SMS] Erro ao enviar notificação de cancelamento:", error);
      return { success: false, error: error.message };
    }

    console.log("[SMS] Notificação de cancelamento enviada com sucesso");
    return { success: true };
  } catch (err) {
    console.error("[SMS] Exceção ao enviar notificação:", err);
    return { success: false, error: String(err) };
  }
}

export async function sendMeetingRescheduledSMS(
  visit: VisitForNotification,
  newDate: Date
): Promise<SendSMSResult> {
  try {
    const deputadoNome = await getOrganizationName();
    const formattedDate = format(newDate, "dd/MM/yyyy", { locale: ptBR });

    const { error } = await supabase.functions.invoke("send-sms", {
      body: {
        phone: visit.contact.telefone_norm,
        templateSlug: "visita-reuniao-reagendada",
        variables: {
          nome: visit.contact.nome,
          protocolo: visit.protocolo,
          nova_data: formattedDate,
          deputado_nome: deputadoNome
        }
      }
    });

    if (error) {
      console.error("[SMS] Erro ao enviar notificação de reagendamento:", error);
      return { success: false, error: error.message };
    }

    console.log("[SMS] Notificação de reagendamento enviada com sucesso");
    return { success: true };
  } catch (err) {
    console.error("[SMS] Exceção ao enviar notificação:", err);
    return { success: false, error: String(err) };
  }
}
