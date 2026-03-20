import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  getVisitForSMSNotification,
  sendMeetingCancelledSMS,
  sendMeetingRescheduledSMS
} from "@/services/office/smsNotificationService";

export function useVisitMeetingActions() {
  const queryClient = useQueryClient();

  const completeMeeting = useMutation({
    mutationFn: async (visitId: string) => {
      const { data, error } = await supabase
        .from("office_visits")
        .update({ status: "MEETING_COMPLETED" })
        .eq("id", visitId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      toast.success("Reunião marcada como realizada!");
    },
    onError: (error) => {
      console.error("Error completing meeting:", error);
      toast.error("Erro ao marcar reunião como realizada");
    }
  });

  const cancelMeeting = useMutation({
    mutationFn: async (visitId: string) => {
      const { data, error } = await supabase
        .from("office_visits")
        .update({ status: "CANCELLED" })
        .eq("id", visitId)
        .select()
        .single();
      if (error) throw error;

      // Enviar SMS de cancelamento em background
      getVisitForSMSNotification(visitId).then(visit => {
        if (visit) {
          sendMeetingCancelledSMS(visit).then(result => {
            if (!result.success) {
              console.warn("[SMS] Falha ao enviar notificação de cancelamento:", result.error);
            }
          });
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      toast.success("Reunião cancelada");
    },
    onError: (error) => {
      console.error("Error canceling meeting:", error);
      toast.error("Erro ao cancelar reunião");
    }
  });

  const rescheduleMeeting = useMutation({
    mutationFn: async ({ visitId, newDate }: { visitId: string; newDate: Date }) => {
      const { data, error } = await supabase
        .from("office_visits")
        .update({
          status: "RESCHEDULED",
          checked_in: false,
          checked_in_at: null,
          rescheduled_date: newDate.toISOString().split('T')[0],
          rescheduled_at: new Date().toISOString()
        })
        .eq("id", visitId)
        .select()
        .single();
      if (error) throw error;

      // Enviar SMS de reagendamento em background
      getVisitForSMSNotification(visitId).then(visit => {
        if (visit) {
          sendMeetingRescheduledSMS(visit, newDate).then(result => {
            if (!result.success) {
              console.warn("[SMS] Falha ao enviar notificação de reagendamento:", result.error);
            }
          });
        }
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["office_visits"] });
      toast.success("Reunião reagendada com sucesso!");
    },
    onError: (error) => {
      console.error("Error rescheduling meeting:", error);
      toast.error("Erro ao reagendar reunião");
    }
  });

  const saveMeetingMinutes = useMutation({
    mutationFn: async ({
      visitId,
      contentType,
      contentText,
      file
    }: {
      visitId: string;
      contentType: 'text' | 'file';
      contentText?: string;
      file?: File;
    }) => {
      let filePath, fileName, fileMimeType;

      if (contentType === 'file' && file) {
        // Upload do arquivo para storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('meeting-minutes')
          .upload(`${visitId}/${file.name}`, file);
        if (uploadError) throw uploadError;
        filePath = uploadData.path;
        fileName = file.name;
        fileMimeType = file.type;
      }

      // Inserir registro na tabela
      const { error: insertError } = await supabase
        .from('office_meeting_minutes')
        .insert({
          visit_id: visitId,
          content_type: contentType,
          content_text: contentType === 'text' ? contentText : null,
          file_path: filePath,
          file_name: fileName,
          file_mime_type: fileMimeType
        });
      if (insertError) throw insertError;

      // Atualizar status da visita
      const { data, error } = await supabase
        .from('office_visits')
        .update({ status: 'MEETING_COMPLETED' })
        .eq('id', visitId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['office_visits'] });
      queryClient.invalidateQueries({ queryKey: ['meeting_minutes'] });
      toast.success('Ata salva e reunião finalizada!');
    },
    onError: (error) => {
      console.error('Error saving meeting minutes:', error);
      toast.error('Erro ao salvar ata');
    }
  });

  return { completeMeeting, cancelMeeting, rescheduleMeeting, saveMeetingMinutes };
}
