import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getVisits,
  getVisitById,
  createVisit,
  updateVisitStatus,
  getVisitWithForm
} from "@/services/office/officeService";
import { sendVisitNotification } from "@/services/office/webhookService";
import { generateVisitFormUrl } from "@/lib/urlHelper";
import type { CreateOfficeVisitDTO, OfficeVisitsFilters, WebhookPayload } from "@/types/office";
import { toast } from "sonner";

export function useOfficeVisits(filters?: OfficeVisitsFilters) {
  return useQuery({
    queryKey: ["office_visits", filters],
    queryFn: () => getVisits(filters)
  });
}

export function useOfficeVisit(id: string) {
  return useQuery({
    queryKey: ["office_visit", id],
    queryFn: () => getVisitById(id),
    enabled: !!id
  });
}

export function useOfficeVisitWithForm(id: string) {
  return useQuery({
    queryKey: ["office_visit_with_form", id],
    queryFn: () => getVisitWithForm(id),
    enabled: !!id
  });
}

export function useCreateOfficeVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      dto,
      userId
    }: {
      dto: CreateOfficeVisitDTO;
      userId: string;
    }) => {
      const visit = await createVisit(dto, userId);

      const payload: WebhookPayload = {
        user_id: visit.contact_id,
        city_id: visit.city_id,
        leader_id: visit.leader_id,
        whatsapp: visit.contact!.telefone_norm,
        nome: dto.nome,
        form_link: generateVisitFormUrl(visit.id),
        protocolo: visit.protocolo
      };

      // Envia via Z-API (se habilitado) ou webhook genérico
      sendVisitNotification(visit.id, payload).then(result => {
        if (result.success) {
          updateVisitStatus(visit.id, "LINK_SENT");
          toast.success("Link enviado com sucesso!");
        } else {
          toast.error("Erro ao enviar mensagem: " + result.error);
        }
      });

      return visit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      toast.success("Visita registrada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar visita: " + error.message);
    }
  });
}

export function useUpdateVisitStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: import("@/types/office").OfficeVisitStatus }) =>
      updateVisitStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      queryClient.invalidateQueries({ queryKey: ["office_visit"] });
    }
  });
}
