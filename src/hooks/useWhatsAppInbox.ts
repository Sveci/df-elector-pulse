import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { useEffect } from "react";

export interface InboxConversation {
  phone: string;
  contactName: string | null;
  contactId: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastDirection: string;
  unreadCount: number;
}

export interface InboxMessage {
  id: string;
  phone: string;
  message: string;
  direction: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  contact_id: string | null;
  metadata: any;
}

function toPhoneDigits(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function toPhoneKey(phone: string): string {
  const digits = toPhoneDigits(phone);
  return digits.length >= 11 ? digits.slice(-11) : digits;
}

export function useInboxConversations() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-conversations", tenantId],
    queryFn: async () => {
      // Get all messages grouped by phone, with latest first
      let q = (supabase as any)
        .from("whatsapp_messages")
        .select("phone, message, direction, status, created_at, contact_id, office_contacts!whatsapp_messages_contact_id_fkey(nome)")
        .order("created_at", { ascending: false });

      if (tenantId) q = q.eq("tenant_id", tenantId);

      const { data, error } = await q.limit(1000);
      if (error) throw error;

      // Group by phone
      const phoneMap = new Map<string, InboxConversation>();

      for (const msg of data || []) {
        if (!phoneMap.has(msg.phone)) {
          phoneMap.set(msg.phone, {
            phone: msg.phone,
            contactName: msg.office_contacts?.nome || null,
            contactId: msg.contact_id,
            lastMessage: msg.message,
            lastMessageAt: msg.created_at,
            lastDirection: msg.direction,
            unreadCount: 0,
          });
        }
        const conv = phoneMap.get(msg.phone)!;
        if (!conv.contactName && msg.office_contacts?.nome) {
          conv.contactName = msg.office_contacts.nome;
        }
        if (msg.direction === "incoming" && msg.status !== "read") {
          conv.unreadCount++;
        }
      }

      // Fallback: resolve contact names by normalized phone key (last 11 digits)
      const unnamed = Array.from(phoneMap.entries()).filter(([, c]) => !c.contactName);
      if (unnamed.length > 0) {
        const unnamedKeys = Array.from(
          new Set(unnamed.map(([phone]) => toPhoneKey(phone)).filter((key) => key.length === 11))
        );

        if (unnamedKeys.length > 0) {
          const suffixFilters = unnamedKeys
            .map((key) => `telefone_norm.ilike.%${key}`)
            .join(",");

          let cq = (supabase as any)
            .from("office_contacts")
            .select("telefone_norm, nome")
            .or(suffixFilters)
            .limit(Math.max(unnamedKeys.length * 3, 50));

          if (tenantId) cq = cq.eq("tenant_id", tenantId);

          const { data: contacts, error: contactsError } = await cq;
          if (!contactsError && contacts) {
            const namesByPhoneKey = new Map<string, string>();

            for (const contact of contacts) {
              const key = toPhoneKey(contact.telefone_norm || "");
              if (key && contact.nome && !namesByPhoneKey.has(key)) {
                namesByPhoneKey.set(key, contact.nome);
              }
            }

            for (const [phone, conv] of unnamed) {
              const key = toPhoneKey(phone);
              const resolvedName = key ? namesByPhoneKey.get(key) : null;
              if (resolvedName) {
                conv.contactName = resolvedName;
              }
            }
          }
        }
      }

      return Array.from(phoneMap.values()).sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
      );
    },
    refetchInterval: 15000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useConversationMessages(phone: string | null) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["inbox-messages", phone, tenantId],
    enabled: !!phone,
    queryFn: async () => {
      let q = (supabase as any)
        .from("whatsapp_messages")
        .select("id, phone, message, direction, status, created_at, sent_at, delivered_at, read_at, contact_id, metadata")
        .eq("phone", phone)
        .order("created_at", { ascending: true });

      if (tenantId) q = q.eq("tenant_id", tenantId);

      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data || []) as InboxMessage[];
    },
  });

  // Realtime for this conversation
  useEffect(() => {
    if (!phone) return;
    const channel = supabase
      .channel(`inbox-chat-${phone}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload: any) => {
          if (payload.new?.phone === phone) {
            queryClient.invalidateQueries({ queryKey: ["inbox-messages", phone] });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [phone, queryClient]);

  return query;
}

export function useSendInboxMessage() {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { phone, message, tenantId, bypassAutoCheck: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["inbox-messages", vars.phone] });
      queryClient.invalidateQueries({ queryKey: ["inbox-conversations"] });
    },
  });
}

export function useInboxContactDetails(phone: string | null) {
  const tenantId = useTenantId();

  return useQuery({
    queryKey: ["inbox-contact", phone, tenantId],
    enabled: !!phone,
    queryFn: async () => {
      // Search by phone suffix
      const phoneSuffix = phone!.replace(/\D/g, "").slice(-9);

      let q = (supabase as any)
        .from("office_contacts")
        .select("id, nome, email, telefone_norm, cidade_id, localidade, genero, data_nascimento, observacao, created_at, office_cities!office_contacts_cidade_id_fkey(nome)")
        .ilike("telefone_norm", `%${phoneSuffix}%`)
        .limit(1)
        .maybeSingle();

      const { data, error } = await q;
      if (error) throw error;
      return data as {
        id: string;
        nome: string;
        email: string | null;
        telefone_norm: string;
        cidade_id: string | null;
        localidade: string | null;
        genero: string | null;
        data_nascimento: string | null;
        observacao: string | null;
        created_at: string;
        office_cities: { nome: string } | null;
      } | null;
    },
  });
}
