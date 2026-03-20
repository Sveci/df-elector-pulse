import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import type { OfficeVisit } from "@/types/office";
import { ptBR } from "date-fns/locale";

interface RescheduleVisitDialogProps {
  visit: OfficeVisit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReschedule: (visitId: string, newDate: Date) => void;
}

export function RescheduleVisitDialog({ visit, open, onOpenChange, onReschedule }: RescheduleVisitDialogProps) {
  const [date, setDate] = useState<Date>();

  const handleReschedule = () => {
    if (date && visit) {
      onReschedule(visit.id, date);
      setDate(undefined);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reagendar Reunião</DialogTitle>
          <DialogDescription>
            Selecione a nova data para a reunião de {visit?.contact?.nome}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center py-6">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            disabled={(date) => date < new Date()}
            locale={ptBR}
            className="rounded-md border pointer-events-auto"
            initialFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleReschedule}
            disabled={!date}
          >
            Confirmar Reagendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
