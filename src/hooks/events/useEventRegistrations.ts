import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


export function useEventRegistrations(eventId?: string) {
  return useQuery({
    queryKey: ["event_registrations", eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          *,
          cidade:office_cities(nome)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!eventId
  });
}

type CreateRegistrationData = {
  event_id: string;
  nome: string;
  email: string;
  whatsapp: string;
  cidade_id?: string;
  localidade?: string;
  leader_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  data_nascimento?: string;
  endereco?: string;
};

export function useCreateRegistration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateRegistrationData) => {
      // Use SECURITY DEFINER RPC function - now returns qr_code directly
      const { data: result, error } = await supabase.rpc('create_event_registration', {
        _event_id: data.event_id,
        _nome: data.nome,
        _email: data.email,
        _whatsapp: data.whatsapp,
        _cidade_id: data.cidade_id || null,
        _leader_id: data.leader_id || null,
        _utm_source: data.utm_source || null,
        _utm_medium: data.utm_medium || null,
        _utm_campaign: data.utm_campaign || null,
        _utm_content: data.utm_content || null,
        _data_nascimento: data.data_nascimento || null,
        _endereco: data.endereco || null,
      });

      if (error) throw error;

      // RPC now returns id, created_at, and qr_code directly
      const resultRow = Array.isArray(result) ? result[0] : result;
      if (!resultRow) throw new Error("Erro ao criar inscrição");

      // Type assertion since types.ts may not be updated yet
      const row = resultRow as { id: string; created_at: string; qr_code: string };

      return {
        id: row.id,
        qr_code: row.qr_code,
        checked_in: false,
        event_id: data.event_id,
        nome: data.nome,
        email: data.email,
        whatsapp: data.whatsapp,
      };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event_registrations", variables.event_id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });
}

export function useUpdateCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checked_in }: { id: string; checked_in: boolean }) => {
      const { data, error } = await supabase
        .from("event_registrations")
        .update({
          checked_in,
          checked_in_at: checked_in ? new Date().toISOString() : null
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["event_registrations", data.event_id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(data.checked_in ? "Check-in realizado!" : "Check-in desfeito!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar check-in: " + error.message);
    }
  });
}
