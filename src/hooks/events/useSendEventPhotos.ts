import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SendEventPhotosParams {
  eventId: string;
  photoUrl: string;
  sendSms: boolean;
  sendEmail: boolean;
}

interface SendResult {
  success: boolean;
  smsSent: number;
  emailSent: number;
  totalParticipants: number;
  shortUrl: string;
  errors?: string[];
}

export function useSendEventPhotos() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getCheckedInCount = async (eventId: string): Promise<number> => {
    const { count, error } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("checked_in", true);

    if (error) {
      console.error("Error counting checked-in participants:", error);
      return 0;
    }

    return count || 0;
  };

  const sendEventPhotos = async (params: SendEventPhotosParams): Promise<SendResult | null> => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-event-photos", {
        body: params
      });

      if (error) {
        console.error("Error sending event photos:", error);
        toast({
          title: "Erro ao enviar fotos",
          description: error.message || "Ocorreu um erro ao enviar as fotos do evento.",
          variant: "destructive"
        });
        return null;
      }

      if (data.error) {
        toast({
          title: "Erro ao enviar fotos",
          description: data.error,
          variant: "destructive"
        });
        return null;
      }

      const result = data as SendResult;

      // Show success toast with summary
      const channels: string[] = [];
      if (result.smsSent > 0) channels.push(`${result.smsSent} SMS`);
      if (result.emailSent > 0) channels.push(`${result.emailSent} emails`);

      toast({
        title: "Fotos enviadas com sucesso!",
        description: channels.length > 0
          ? `Enviado: ${channels.join(" e ")}`
          : "Nenhuma mensagem foi enviada. Verifique as configurações de integração."
      });

      // Show warnings if any
      if (result.errors && result.errors.length > 0) {
        setTimeout(() => {
          toast({
            title: "Alguns envios falharam",
            description: result.errors!.slice(0, 3).join("\n"),
            variant: "destructive"
          });
        }, 1000);
      }

      return result;

    } catch (err: any) {
      console.error("useSendEventPhotos: Fatal error:", err);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive"
      });
      return null;

    } finally {
      setIsLoading(false);
    }
  };

  return {
    sendEventPhotos,
    getCheckedInCount,
    isLoading
  };
}
