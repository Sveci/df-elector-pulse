import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Secure public check-in via QR code (uses SECURITY DEFINER function)
export function useUpdateVisitCheckIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (qrCode: string) => {
      const { data, error } = await supabase
        .rpc("checkin_visit_by_qr", { _qr_code: qrCode });

      if (error) throw error;
      if (!data) throw new Error("Check-in failed - visit not found or invalid status");

      return { success: true };
    },
    onSuccess: (_, qrCode) => {
      queryClient.invalidateQueries({ queryKey: ["visit_by_qr", qrCode] });
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      queryClient.invalidateQueries({ queryKey: ["office_visit"] });
      toast.success("Check-in realizado com sucesso!");
    },
    onError: (error: Error) => {
      console.error("Error updating check-in:", error);
      toast.error("Erro ao realizar check-in: " + error.message);
    }
  });
}

// Authenticated check-in via visit ID (for admin/atendente staff)
export function useUpdateVisitCheckInById() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, checked_in }: { id: string; checked_in: boolean }) => {
      const { data, error } = await supabase
        .from("office_visits")
        .update({
          checked_in,
          checked_in_at: checked_in ? new Date().toISOString() : null,
          status: checked_in ? 'CHECKED_IN' : 'FORM_SUBMITTED'
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      queryClient.invalidateQueries({ queryKey: ["office_visit"] });
      queryClient.invalidateQueries({ queryKey: ["visit_by_qr"] });
      toast.success(data.checked_in ? "Check-in realizado com sucesso!" : "Check-in desfeito");
    },
    onError: (error) => {
      console.error("Error updating check-in:", error);
      toast.error("Erro ao atualizar check-in");
    }
  });
}
