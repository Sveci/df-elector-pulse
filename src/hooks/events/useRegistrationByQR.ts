import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RegistrationByQR {
  id: string;
  nome: string;
  checked_in: boolean;
  checked_in_at: string | null;
  event_id: string;
  event_name: string;
  event_date: string;
  event_time: string;
  event_location: string;
  event_address: string | null;
  event_category: string;
  event_registration_deadline_hours: number | null;
}

export function useRegistrationByQR(qrCode: string) {
  return useQuery({
    queryKey: ["registration_by_qr", qrCode],
    queryFn: async (): Promise<RegistrationByQR | null> => {
      const { data, error } = await supabase
        .rpc("get_registration_by_qr", { _qr_code: qrCode });

      if (error) throw error;

      // RPC returns an array, get the first result
      if (data && data.length > 0) {
        return data[0] as RegistrationByQR;
      }
      return null;
    },
    enabled: !!qrCode,
    retry: false
  });
}

export function useUpdateCheckInByQR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ qrCode, checked_in }: { qrCode: string; checked_in: boolean }) => {
      const { data, error } = await supabase
        .rpc("checkin_event_by_qr", {
          _qr_code: qrCode,
          _checked_in: checked_in
        });

      if (error) throw error;
      if (!data) throw new Error("Check-in failed");

      return { success: true, checked_in };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["registration_by_qr", variables.qrCode] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(data.checked_in ? "Check-in realizado!" : "Check-in desfeito!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar check-in: " + error.message);
    }
  });
}
