import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface RetryHistoryEntry {
  attempt: number;
  timestamp: string;
  status: string;
  error?: string;
  next_retry_at?: string;
}

export interface SMSMessage {
  id: string;
  message_id: string | null;
  phone: string;
  message: string;
  direction: string;
  status: string;
  contact_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  retry_count: number;
  max_retries: number;
  last_retry_at: string | null;
  next_retry_at: string | null;
  retry_history: RetryHistoryEntry[];
  contact?: {
    nome: string;
  } | null;
}

export interface SMSFilters {
  search?: string;
  direction?: string;
  status?: string;
  period?: string;
}

export interface SMSMetrics {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
}

export function useSMSMessages(filters: SMSFilters = {}) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["sms-messages", filters, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("sms_messages")
        .select(`
          *,
          contact:office_contacts(id, nome)
        `)
        .order("created_at", { ascending: false });

      // Filter by active tenant
      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      // Apply direction filter
      if (filters.direction && filters.direction !== "all") {
        query = query.eq("direction", filters.direction);
      }

      // Apply status filter
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      // Apply period filter
      if (filters.period && filters.period !== "all") {
        const now = new Date();
        let startDate: Date;

        switch (filters.period) {
          case "today":
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case "week":
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(0);
        }

        query = query.gte("created_at", startDate.toISOString());
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;

      // Apply search filter client-side and transform data
      let filtered = (data || []).map((msg) => ({
        ...msg,
        retry_history: Array.isArray(msg.retry_history) 
          ? (msg.retry_history as unknown as RetryHistoryEntry[]) 
          : [],
      })) as SMSMessage[];
      
      if (filters.search) {
        const search = filters.search.toLowerCase();
        filtered = filtered.filter(
          (msg) =>
            msg.phone.includes(search) ||
            msg.message.toLowerCase().includes(search) ||
            msg.contact?.nome?.toLowerCase().includes(search)
        );
      }

      return filtered;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function useSMSMetrics() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["sms-metrics", tenantId],
    queryFn: async () => {
      const baseQuery = () => {
        let q = supabase.from("sms_messages").select("*", { count: "exact", head: true }).eq("direction", "outgoing");
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q;
      };

      const [totalResult, queuedResult, sentResult, deliveredResult, failedResult] = await Promise.all([
        baseQuery(),
        baseQuery().eq("status", "queued"),
        baseQuery().eq("status", "sent"),
        baseQuery().eq("status", "delivered"),
        baseQuery().eq("status", "failed"),
      ]);

      if (totalResult.error) throw totalResult.error;
      if (queuedResult.error) throw queuedResult.error;
      if (sentResult.error) throw sentResult.error;
      if (deliveredResult.error) throw deliveredResult.error;
      if (failedResult.error) throw failedResult.error;

      const total = totalResult.count || 0;
      const queued = queuedResult.count || 0;
      const sent = sentResult.count || 0;
      const delivered = deliveredResult.count || 0;
      const failed = failedResult.count || 0;

      const successfulSends = queued + sent + delivered;
      const deliveryRate = total > 0 ? (successfulSends / total) * 100 : 0;

      return {
        total,
        queued,
        sent,
        delivered,
        failed,
        deliveryRate,
      } as SMSMetrics;
    },
    refetchInterval: 30000,
    staleTime: 10000,
  });
}
