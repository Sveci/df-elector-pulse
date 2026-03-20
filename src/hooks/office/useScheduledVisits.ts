import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface ScheduledVisit {
  id: string;
  protocolo: string;
  status: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  scheduled_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  contact: {
    id: string;
    nome: string;
    telefone_norm: string;
  } | null;
  city: {
    id: string;
    nome: string;
  } | null;
  leader: {
    id: string;
    nome_completo: string;
  } | null;
}

// Buscar visitas agendadas por mês
export function useScheduledVisitsByMonth(month: Date) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  return useQuery({
    queryKey: ["scheduled-visits-month", format(month, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_visits")
        .select(`
          id, protocolo, status, scheduled_date, scheduled_time, scheduled_by, confirmed_at, created_at,
          contact:office_contacts(id, nome, telefone_norm),
          city:office_cities(id, nome),
          leader:lideres(id, nome_completo)
        `)
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", format(start, "yyyy-MM-dd"))
        .lte("scheduled_date", format(end, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true })
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data as ScheduledVisit[];
    },
    staleTime: 0,
  });
}

// Buscar visitas agendadas para um dia específico
export function useScheduledVisitsByDate(date: Date) {
  return useQuery({
    queryKey: ["scheduled-visits-date", format(date, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_visits")
        .select(`
          id, protocolo, status, scheduled_date, scheduled_time, scheduled_by, confirmed_at, created_at,
          contact:office_contacts(id, nome, telefone_norm),
          city:office_cities(id, nome),
          leader:lideres(id, nome_completo)
        `)
        .eq("scheduled_date", format(date, "yyyy-MM-dd"))
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data as ScheduledVisit[];
    },
    staleTime: 0,
  });
}

// Buscar visitas agendadas para hoje (para Queue)
export function useScheduledVisitsToday() {
  const today = new Date();

  return useQuery({
    queryKey: ["scheduled-visits-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_visits")
        .select(`
          id, protocolo, status, scheduled_date, scheduled_time, scheduled_by, confirmed_at, created_at, checked_in, checked_in_at,
          contact:office_contacts(id, nome, telefone_norm),
          city:office_cities(id, nome),
          leader:lideres(id, nome_completo)
        `)
        .eq("scheduled_date", format(today, "yyyy-MM-dd"))
        .order("scheduled_time", { ascending: true });

      if (error) throw error;
      return data as ScheduledVisit[];
    },
    staleTime: 0,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export interface CreateScheduledVisitInput {
  nome: string;
  telefone: string;
  cidadeId: string;
  leaderId?: string;
  scheduledDate: string;
  scheduledTime: string;
}

// Criar visita agendada
export function useCreateScheduledVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateScheduledVisitInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1. Normalizar telefone
      const normalizedPhone = normalizePhone(input.telefone);

      // 2. Criar ou buscar contato
      let contactId: string;

      const { data: existingContact } = await supabase
        .from("office_contacts")
        .select("id")
        .eq("telefone_norm", normalizedPhone)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact, error: contactError } = await supabase
          .from("office_contacts")
          .insert({
            nome: input.nome,
            telefone_norm: normalizedPhone,
            cidade_id: input.cidadeId,
            source_type: input.leaderId ? "lider" : "visita",
            source_id: input.leaderId || null,
          })
          .select("id")
          .single();

        if (contactError) throw contactError;
        contactId = newContact.id;
      }

      // 3. Gerar protocolo
      const { data: protocolData, error: protocolError } = await supabase
        .rpc("generate_office_protocol");

      if (protocolError) throw protocolError;

      // 4. Criar visita agendada
      const { data: visit, error: visitError } = await supabase
        .from("office_visits")
        .insert({
          contact_id: contactId,
          leader_id: input.leaderId || null,
          city_id: input.cidadeId,
          protocolo: protocolData,
          status: "SCHEDULED",
          scheduled_date: input.scheduledDate,
          scheduled_time: input.scheduledTime,
          scheduled_by: userId,
          created_by: userId,
        })
        .select(`
          id, protocolo, scheduled_date, scheduled_time,
          contact:office_contacts(id, nome, telefone_norm)
        `)
        .single();

      if (visitError) throw visitError;

      return visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-visits-month"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-visits-date"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-visits-today"] });
      queryClient.invalidateQueries({ queryKey: ["office-visits"] });
    },
  });
}

// Função para normalizar telefone
function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");

  if (clean.startsWith("55")) {
    clean = clean.substring(2);
  }

  if (clean.length === 10 && clean.startsWith("61")) {
    clean = "61" + "9" + clean.substring(2);
  }

  if (clean.length === 9) {
    clean = "61" + clean;
  } else if (clean.length === 8) {
    clean = "61" + "9" + clean;
  }

  return "+55" + clean;
}

// Estatísticas do mês
export function useScheduledVisitsStats(month: Date) {
  const start = startOfMonth(month);
  const end = endOfMonth(month);

  return useQuery({
    queryKey: ["scheduled-visits-stats", format(month, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_visits")
        .select("id, status, confirmed_at")
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", format(start, "yyyy-MM-dd"))
        .lte("scheduled_date", format(end, "yyyy-MM-dd"));

      if (error) throw error;

      const total = data?.length || 0;
      const confirmed = data?.filter(v => v.confirmed_at).length || 0;
      const pending = total - confirmed;

      return { total, confirmed, pending };
    },
    staleTime: 0,
  });
}
