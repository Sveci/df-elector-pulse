import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface EmailReportItem {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  template_id: string | null;
  template_nome: string | null;
  template_slug: string | null;
  leader_id: string | null;
  contact_id: string | null;
  leader_nome: string | null;
  leader_telefone: string | null;
  leader_cidade: string | null;
  contact_nome: string | null;
  contact_telefone: string | null;
  contact_cidade: string | null;
}

export interface EmailReportFilters {
  templateId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useEmailReport(filters: EmailReportFilters) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["email_report", filters, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("email_logs")
        .select(`
          id,
          to_email,
          to_name,
          subject,
          status,
          error_message,
          sent_at,
          created_at,
          template_id,
          leader_id,
          contact_id,
          email_templates (
            nome,
            slug
          ),
          lideres (
            nome_completo,
            telefone,
            office_cities:cidade_id (nome)
          ),
          office_contacts:contact_id (
            nome,
            telefone_norm,
            office_cities:cidade_id (nome)
          )
        `)
        .order("created_at", { ascending: false });

      // Filter by active tenant
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      if (filters.templateId) {
        query = query.eq("template_id", filters.templateId);
      }
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("created_at", filters.endDate + "T23:59:59");
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to flat structure
      const transformedData: EmailReportItem[] = (data || []).map((item: any) => ({
        id: item.id,
        to_email: item.to_email,
        to_name: item.to_name,
        subject: item.subject,
        status: item.status,
        error_message: item.error_message,
        sent_at: item.sent_at,
        created_at: item.created_at,
        template_id: item.template_id,
        template_nome: item.email_templates?.nome || null,
        template_slug: item.email_templates?.slug || null,
        leader_id: item.leader_id,
        contact_id: item.contact_id,
        leader_nome: item.lideres?.nome_completo || null,
        leader_telefone: item.lideres?.telefone || null,
        leader_cidade: item.lideres?.office_cities?.nome || null,
        contact_nome: item.office_contacts?.nome || null,
        contact_telefone: item.office_contacts?.telefone_norm || null,
        contact_cidade: item.office_contacts?.office_cities?.nome || null,
      }));

      // Apply search filter client-side
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        return transformedData.filter(item => 
          item.to_email?.toLowerCase().includes(searchLower) ||
          item.to_name?.toLowerCase().includes(searchLower) ||
          item.leader_nome?.toLowerCase().includes(searchLower) ||
          item.contact_nome?.toLowerCase().includes(searchLower)
        );
      }

      return transformedData;
    },
    enabled: !!filters.templateId,
  });
}

export function useEmailReportStats(templateId: string | undefined) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["email_report_stats", templateId, tenantId],
    queryFn: async () => {
      if (!templateId) return null;

      const baseQuery = () => {
        let q = supabase.from("email_logs").select("*", { count: "exact", head: true }).eq("template_id", templateId);
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

      const total = totalResult.count || 0;
      const sent = sentResult.count || 0;
      const pending = pendingResult.count || 0;
      const failed = failedResult.count || 0;

      return {
        total,
        sent,
        pending,
        failed,
        successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
        failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
      };
    },
    enabled: !!templateId,
  });
}
