import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { downloadCalendarEvent, createEventDates, CalendarEventData } from "@/lib/calendarUtils";
import { toast } from "@/hooks/use-toast";

interface EventData {
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  location: string;
  address?: string;
  description?: string;
  slug?: string;
}

interface AddToCalendarButtonProps {
  event: EventData;
  className?: string;
}

export function AddToCalendarButton({ event, className }: AddToCalendarButtonProps) {
  const handleAddToCalendar = () => {
    try {
      // Criar datas de início e fim (duração padrão de 2 horas)
      const { startDate, endDate } = createEventDates(event.date, event.time, 2);

      // Preparar dados do evento para o calendário
      const calendarEvent: CalendarEventData = {
        title: event.name,
        description: event.description,
        location: event.location,
        address: event.address,
        startDate,
        endDate,
        uid: event.slug ? `evento-${event.slug}@eleitor360.ai` : undefined,
      };

      // Gerar nome do arquivo
      const filename = event.slug
        ? `evento-${event.slug}`
        : `evento-${event.date}`;

      // Fazer download do arquivo .ics
      downloadCalendarEvent(calendarEvent, filename);

      toast({
        title: "Evento salvo!",
        description: "O arquivo do calendário foi baixado. Abra-o para adicionar ao seu calendário.",
      });
    } catch (error) {
      console.error('Erro ao gerar arquivo de calendário:', error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o arquivo do calendário.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      onClick={handleAddToCalendar}
      variant="outline"
      className={className}
    >
      <CalendarPlus className="w-4 h-4 mr-2" />
      Adicionar ao Calendário
    </Button>
  );
}
