import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderWhatsAppMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface LeaderEmailLog {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface RetryHistoryEntry {
  attempt: number;
  timestamp: string;
  status: string;
  error?: string;
  delay_minutes?: number;
}

export interface LeaderSMSMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
  retry_count: number | null;
  last_retry_at: string | null;
  next_retry_at: string | null;
  max_retries: number | null;
  retry_history: unknown;
}

export function useLeaderCommunications(leaderId: string | undefined, leaderPhone: string | undefined, leaderEmail: string | undefined) {
  // WhatsApp messages por leader_id primeiro, depois por telefone
  const whatsappQuery = useQuery({
    queryKey: ["leader_whatsapp", leaderId, leaderPhone],
    queryFn: async (): Promise<LeaderWhatsAppMessage[]> => {
      if (!leaderId && !leaderPhone) return [];

      // Tentar primeiro por leader_id (nas mensagens novas)
      // Nota: whatsapp_messages não tem leader_id, então vamos buscar por telefone
      if (!leaderPhone) return [];

      // Normalizar telefone para formato E.164
      const normalizedPhone = leaderPhone.replace(/\D/g, '');
      const phoneSuffix = normalizedPhone.slice(-8); // Últimos 8 dígitos para matching

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .ilike("phone", `%${phoneSuffix}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!(leaderId || leaderPhone),
  });

  // Email logs por leader_id primeiro, depois por email
  const emailQuery = useQuery({
    queryKey: ["leader_emails", leaderId, leaderEmail],
    queryFn: async (): Promise<LeaderEmailLog[]> => {
      if (!leaderId && !leaderEmail) return [];

      // Tentar primeiro por leader_id
      if (leaderId) {
        const { data: byLeaderId, error: leaderError } = await supabase
          .from("email_logs")
          .select("*")
          .eq("leader_id", leaderId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (leaderError) {
          console.error("Error fetching emails by leader_id:", leaderError);
        }

        // Se encontrou por leader_id, retorna
        if (byLeaderId && byLeaderId.length > 0) {
          return byLeaderId;
        }
      }

      // Fallback: buscar por email address
      if (leaderEmail) {
        const { data: byEmail, error: emailError } = await supabase
          .from("email_logs")
          .select("*")
          .eq("to_email", leaderEmail)
          .order("created_at", { ascending: false })
          .limit(50);

        if (emailError) {
          console.error("Error fetching emails by email address:", emailError);
          return [];
        }

        return byEmail || [];
      }

      return [];
    },
    enabled: !!(leaderId || leaderEmail),
  });

  // SMS messages por telefone
  const smsQuery = useQuery({
    queryKey: ["leader_sms", leaderId, leaderPhone],
    queryFn: async (): Promise<LeaderSMSMessage[]> => {
      if (!leaderPhone) return [];

      const normalizedPhone = leaderPhone.replace(/\D/g, '');
      const phoneSuffix = normalizedPhone.slice(-8);

      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .ilike("phone", `%${phoneSuffix}%`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!leaderPhone,
  });

  return {
    whatsappMessages: whatsappQuery.data || [],
    emailLogs: emailQuery.data || [],
    smsMessages: smsQuery.data || [],
    isLoading: whatsappQuery.isLoading || emailQuery.isLoading || smsQuery.isLoading,
  };
}
