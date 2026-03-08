import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { useCreateScheduledVisit } from "@/hooks/office/useScheduledVisits";
import { ContactPhoneAutocomplete } from "@/components/office/ContactPhoneAutocomplete";
import { LeaderAutocomplete } from "@/components/office/LeaderAutocomplete";
import { Loader2, CalendarIcon, Clock, Send } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateVisitFormUrl } from "@/lib/urlHelper";

interface CreateScheduledVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
}

interface SelectedContact {
  id: string;
  nome: string;
  telefone_norm: string;
  cidade_id: string | null;
  cidade: { id: string; nome: string } | null;
  last_leader_id: string | null;
  last_leader: { id: string; nome_completo: string } | null;
}

const TIME_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30"
];

export function CreateScheduledVisitDialog({ open, onOpenChange, initialDate }: CreateScheduledVisitDialogProps) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [leaderId, setLeaderId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(initialDate || addDays(new Date(), 1));
  const [time, setTime] = useState<string>("");
  const [sendingSms, setSendingSms] = useState(false);
  const [selectedContact, setSelectedContact] = useState<SelectedContact | null>(null);

  const createVisit = useCreateScheduledVisit();

  // Auto-preencher nome, cidade e líder quando contato é selecionado
  const handleContactSelect = (contact: SelectedContact | null) => {
    setSelectedContact(contact);
    if (contact) {
      setNome(contact.nome);
      if (contact.cidade?.id) {
        setCidadeId(contact.cidade.id);
      }
      if (contact.last_leader_id) {
        setLeaderId(contact.last_leader_id);
      }
    }
  };

  // Limpar líder apenas quando cidade muda manualmente (não pelo contato)
  const prevCidadeRef = useRef(cidadeId);
  useEffect(() => {
    // Só limpar se a cidade mudou E não veio do contato selecionado
    if (prevCidadeRef.current !== cidadeId && prevCidadeRef.current !== "") {
      if (!selectedContact?.last_leader_id) {
        setLeaderId("");
      }
    }
    prevCidadeRef.current = cidadeId;
  }, [cidadeId, selectedContact]);

  const resetForm = () => {
    setNome("");
    setTelefone("");
    setCidadeId("");
    setLeaderId("");
    setDate(initialDate || addDays(new Date(), 1));
    setTime("");
    setSelectedContact(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome || !telefone || !cidadeId || !leaderId || !date || !time) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const result = await createVisit.mutateAsync({
        nome,
        telefone,
        cidadeId,
        leaderId: leaderId || undefined,
        scheduledDate: format(date, "yyyy-MM-dd"),
        scheduledTime: time,
      });

      // Enviar SMS automaticamente
      setSendingSms(true);
      
      const formattedDate = format(date, "dd/MM/yyyy", { locale: ptBR });
      const formattedTime = time;
      // SEMPRE usa URL de produção (via função dedicada - enviado externamente via SMS)
      const linkFormulario = generateVisitFormUrl(result.id);

      const { error: smsError } = await supabase.functions.invoke("send-sms", {
        body: {
          phone: telefone,
          templateSlug: "visita-agendada-link-formulario",
          variables: {
            nome: nome.split(" ")[0],
            data_agendada: formattedDate,
            hora_agendada: formattedTime,
            link_formulario: linkFormulario,
            protocolo: result.protocolo,
          },
        },
      });

      if (smsError) {
        console.error("Erro ao enviar SMS:", smsError);
        toast.warning("Visita agendada, mas erro ao enviar SMS");
      } else {
        toast.success(`Visita agendada para ${formattedDate} às ${formattedTime}. SMS enviado!`);
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar visita:", error);
      toast.error("Erro ao agendar visita");
    } finally {
      setSendingSms(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Agendar Nova Visita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telefone">WhatsApp *</Label>
            <ContactPhoneAutocomplete
              value={telefone}
              onPhoneChange={setTelefone}
              onContactSelect={handleContactSelect}
              disabled={createVisit.isPending || sendingSms}
            />
            <p className="text-xs text-muted-foreground">
              Digite o número para buscar contatos existentes
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome Completo *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do visitante"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Cidade/RA *</Label>
            <RegionSelect
              value={cidadeId}
              onValueChange={setCidadeId}
              placeholder="Selecione a cidade/RA"
            />
          </div>

          <div className="space-y-2">
            <Label>Líder *</Label>
            <LeaderAutocomplete
              value={leaderId}
              onValueChange={setLeaderId}
              cityId={cidadeId}
              disabled={createVisit.isPending || sendingSms || !cidadeId}
              placeholder={!cidadeId ? "Selecione a cidade primeiro" : "Buscar líder..."}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    disabled={(d) => d < new Date()}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Horário *</Label>
              <Select value={time} onValueChange={setTime} required>
                <SelectTrigger>
                  <Clock className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createVisit.isPending || sendingSms}>
              {createVisit.isPending || sendingSms ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {sendingSms ? "Enviando SMS..." : "Agendando..."}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Agendar e Enviar SMS
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
