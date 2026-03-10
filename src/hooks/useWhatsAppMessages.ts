import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

export interface WhatsAppMessage {
  id: string;
  message_id: string | null;
  phone: string;
  message: string;
  direction: string;
  status: string;
  visit_id: string | null;
  contact_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: {
    nome: string;
    telefone_norm: string;
  } | null;
  visit?: {
    protocolo: string;
  } | null;
}

export interface WhatsAppFilters {
  search: string;
  direction: "all" | "outgoing" | "incoming";
  status: "all" | "pending" | "sent" | "delivered" | "read" | "failed";
  period: "today" | "7days" | "30days" | "all";
}

export interface WhatsAppMetrics {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
}

export function useWhatsAppMessages(filters: WhatsAppFilters) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["whatsapp-messages", filters, tenantId],
    queryFn: async () => {
      let startDate: string | null = null;
      if (filters.period !== "all") {
        const now = new Date();
        let sd: Date;
        switch (filters.period) {
          case "today":
            sd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case "7days":
            sd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "30days":
            sd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            sd = new Date(0);
        }
        startDate = sd.toISOString();
      }

      // Fetch ALL messages in batches to avoid the 1000-row limit
      const pageSize = 1000;
      const allMessages: any[] = [];
      let from = 0;

      while (true) {
        let query = supabase
          .from("whatsapp_messages")
          .select(`
            *,
            contact:office_contacts(nome, telefone_norm),
            visit:office_visits(protocolo)
          `)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        // Filter by active tenant
        if (tenantId) {
          query = query.eq("tenant_id", tenantId);
        }

        if (filters.direction !== "all") {
          query = query.eq("direction", filters.direction);
        }
        if (filters.status !== "all") {
          query = query.eq("status", filters.status);
        }
        if (startDate) {
          query = query.gte("created_at", startDate);
        }

        const { data: page, error } = await query;
        if (error) throw error;
        if (!page || page.length === 0) break;

        allMessages.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      const data = allMessages;

      let filteredData = data as WhatsAppMessage[];

      // For messages without contact info via contact_id, try to match by phone.
      // IMPORTANT: fetch in batches to avoid the 1000 row limit.
      const needsPhoneLookup = filteredData.some((msg) => !msg.contact?.nome);

      if (needsPhoneLookup) {
        const pageSize = 1000;

        const fetchAll = async <T,>(table: string, select: string): Promise<T[]> => {
          let from = 0;
          const all: T[] = [];

          while (true) {
            let q = (supabase as any)
              .from(table)
              .select(select)
              .range(from, from + pageSize - 1);

            if (tenantId) {
              q = q.eq("tenant_id", tenantId);
            }

            const { data: page, error: pageError } = await q;

            if (pageError) throw pageError;
            if (!page || page.length === 0) break;

            all.push(...(page as T[]));
            if (page.length < pageSize) break;
            from += pageSize;
          }

          return all;
        };

        const [contacts, leaders] = await Promise.all([
          fetchAll<{ nome: string | null; telefone_norm: string }>(
            "office_contacts",
            "nome, telefone_norm"
          ),
          fetchAll<{ nome_completo: string; telefone: string | null }>(
            "lideres",
            "nome_completo, telefone"
          ),
        ]);

        // Map: last 8 digits -> name (prefer office_contacts, fallback to lideres)
        const phoneToNameMap = new Map<string, string>();

        for (const c of contacts) {
          if (!c?.nome || !c?.telefone_norm) continue;
          const last8 = c.telefone_norm.replace(/\D/g, "").slice(-8);
          if (last8) phoneToNameMap.set(last8, c.nome);
        }

        for (const l of leaders) {
          if (!l?.nome_completo || !l?.telefone) continue;
          const last8 = l.telefone.replace(/\D/g, "").slice(-8);
          if (last8 && !phoneToNameMap.has(last8)) phoneToNameMap.set(last8, l.nome_completo);
        }

        filteredData = filteredData.map((msg) => {
          if (msg.contact?.nome) return msg;

          const msgLast8 = msg.phone.replace(/\D/g, "").slice(-8);
          const name = phoneToNameMap.get(msgLast8);
          if (!name) return msg;

          return {
            ...msg,
            contact: {
              nome: name,
              telefone_norm: msg.phone,
            },
          };
        });
      }

      // Client-side search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredData = filteredData.filter((msg) => {
          const phoneMatch = msg.phone.includes(filters.search);
          const messageMatch = msg.message.toLowerCase().includes(searchLower);
          const contactMatch = msg.contact?.nome?.toLowerCase().includes(searchLower);
          return phoneMatch || messageMatch || contactMatch;
        });
      }

      return filteredData;
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });
}

export function useWhatsAppMetrics() {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["whatsapp-metrics", tenantId],
    queryFn: async () => {
      const baseQuery = () => {
        let q = supabase.from("whatsapp_messages").select("*", { count: "exact", head: true }).eq("direction", "outgoing");
        if (tenantId) q = q.eq("tenant_id", tenantId);
        return q;
      };

      const [totalResult, sentResult, deliveredResult, readResult, failedResult] = await Promise.all([
        baseQuery(),
        baseQuery().eq("status", "sent"),
        baseQuery().eq("status", "delivered"),
        baseQuery().eq("status", "read"),
        baseQuery().eq("status", "failed"),
      ]);

      const total = totalResult.count || 0;
      const sent = sentResult.count || 0;
      const delivered = deliveredResult.count || 0;
      const read = readResult.count || 0;
      const failed = failedResult.count || 0;

      const successfulDeliveries = delivered + read;
      const deliveryRate = total > 0 ? (successfulDeliveries / total) * 100 : 0;
      const readRate = successfulDeliveries > 0 ? (read / successfulDeliveries) * 100 : 0;

      return {
        total,
        sent,
        delivered,
        read,
        failed,
        deliveryRate,
        readRate,
      } as WhatsAppMetrics;
    },
    staleTime: 10000,
    refetchInterval: 15000,
  });
}
