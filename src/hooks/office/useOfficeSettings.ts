import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSettings, updateSettings } from "@/services/office/officeService";
import type { OfficeSettings } from "@/types/office";
import { toast } from "sonner";

export function useOfficeSettings() {
  return useQuery({
    queryKey: ["office_settings"],
    queryFn: () => getSettings()
  });
}

export function useUpdateOfficeSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<OfficeSettings>) =>
      updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office_settings"] });
      toast.success("Configurações atualizadas com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar configurações: " + error.message);
    }
  });
}
