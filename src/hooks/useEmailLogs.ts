import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface EmailLog {
  id: string;
  template_id: string | null;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  resend_id: string | null;
  error_message: string | null;
  body_html: string | null;
  contact_id: string | null;
  leader_id: string | null;
  event_id: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  email_templates?: {
    nome: string;
    slug: string;
  } | null;
}

export function useEmailLogs(filters?: {
  templateId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["email_logs", filters, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select(`
          *,
          body_html,
          email_templates (nome, slug)
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      // Filter by active tenant
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      if (filters?.templateId) {
        query = query.eq("template_id", filters.templateId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailLog[];
    },
    refetchInterval: 30000,
  });
}

export function useEmailLogStats() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["email_log_stats", tenantId],
    queryFn: async () => {
      const baseQuery = () => {
        let q = supabase.from("email_logs").select("*", { count: "exact", head: true });
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q;
      };

      const [totalResult, sentResult, pendingResult, failedResult] = await Promise.all([
        baseQuery(),
        baseQuery().eq("status", "sent"),
        baseQuery().eq("status", "pending"),
        baseQuery().eq("status", "failed"),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (sentResult.error) throw sentResult.error;
      if (pendingResult.error) throw pendingResult.error;
      if (failedResult.error) throw failedResult.error;

      return {
        total: totalResult.count || 0,
        sent: sentResult.count || 0,
        pending: pendingResult.count || 0,
        failed: failedResult.count || 0,
      };
    },
  });
}

/**
 * Retry a failed email by re-invoking the send-email edge function
 * using the body_html stored in the log record.
 */
export function useRetryEmailLog() {
  const queryClient = useQueryClient();
  const tenantId = useTenantId();

  return useMutation({
    mutationFn: async (log: EmailLog) => {
      if (!log.body_html) {
        throw new Error("Conteúdo do email não disponível para reenvio");
      }

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          to: log.to_email,
          toName: log.to_name ?? undefined,
          subject: log.subject,
          html: log.body_html,
          tenantId: tenantId ?? undefined,
          contactId: log.contact_id ?? undefined,
          leaderId: log.leader_id ?? undefined,
          eventId: log.event_id ?? undefined,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao reenviar email");

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email_logs"] });
      queryClient.invalidateQueries({ queryKey: ["email_log_stats"] });
    },
  });
}
