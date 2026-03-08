import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Search, CheckCircle, Phone, User, MapPin, Info, ChevronRight, QrCode, Calendar as CalendarIcon, Clock } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CitySelect } from "@/components/office/CitySelect";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { ContactPhoneAutocomplete } from "@/components/office/ContactPhoneAutocomplete";
import { LeaderAutocomplete } from "@/components/office/LeaderAutocomplete";
import { ProtocolBadge } from "@/components/office/ProtocolBadge";
import { useOfficeSettings } from "@/hooks/office/useOfficeSettings";
import { useCreateScheduledVisit } from "@/hooks/office/useScheduledVisits";
import { cn } from "@/lib/utils";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const newVisitTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="new-visit-form"]',
    title: "Nova Visita",
    content: "Cadastre rapidamente uma nova visita ao gabinete. Preencha os dados do visitante e agende a data/hora.",
    placement: "right",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="new-visit-phone"]',
    title: "WhatsApp",
    content: "Digite o número para buscar contatos existentes ou cadastrar um novo visitante.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="new-visit-schedule"]',
    title: "Agendamento",
    content: "Selecione a data e horário da visita. O visitante receberá um SMS com o link do formulário.",
    placement: "top",
  },
];

const generateVisitFormUrl = (visitId: string) => {
  return `${window.location.origin}/visit-checkin/${visitId}`;
};

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

export default function NewVisit() {
  const navigate = useNavigate();
  const { restartTutorial } = useTutorial("office-new-visit", newVisitTutorialSteps);
  
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cidadeId, setCidadeId] = useState("");
  const [localidade, setLocalidade] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const locationConfig = useTenantLocationConfig();
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [visitCreated, setVisitCreated] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<SelectedContact | null>(null);
  
  const { data: settings } = useOfficeSettings();
  const createVisit = useCreateScheduledVisit();
  
  const handlePhoneChange = (phone: string) => {
    setWhatsapp(phone);
  };
  
  const handleContactSelect = (contact: SelectedContact | null) => {
    setSelectedContact(contact);
    if (contact) {
      setNome(contact.nome);
      setCidadeId(contact.cidade_id || "");
      if (contact.last_leader_id) {
        setLeaderId(contact.last_leader_id);
      }
    }
  };
  
  // Limpar líder apenas quando cidade muda manualmente (não pelo contato)
  const prevCidadeRef = useRef(cidadeId);
  useEffect(() => {
    if (prevCidadeRef.current !== cidadeId && prevCidadeRef.current !== "") {
      if (!selectedContact?.last_leader_id) {
        setLeaderId("");
      }
    }
    prevCidadeRef.current = cidadeId;
  }, [cidadeId, selectedContact]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !whatsapp || !cidadeId || !leaderId || !scheduledDate || !scheduledTime) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    
    try {
      const formattedDate = format(scheduledDate, "yyyy-MM-dd");
      
      const visit = await createVisit.mutateAsync({
        nome,
        telefone: whatsapp,
        cidadeId,
        leaderId,
        scheduledDate: formattedDate,
        scheduledTime,
      });
      
      setVisitCreated({
        ...visit,
        scheduledDate,
        scheduledTime,
      });
      
      const link = generateVisitFormUrl(visit.id);
      const qr = await QRCode.toDataURL(link);
      setQrCode(qr);
      
      // Enviar SMS com data e hora agendada
      const formattedDateBR = format(scheduledDate, "dd/MM/yyyy", { locale: ptBR });
      const primeiroNome = nome.split(" ")[0];
      
      try {
        await supabase.functions.invoke("send-sms", {
          body: {
            phone: whatsapp,
            templateSlug: "visita-agendada-link-formulario",
            variables: {
              nome: primeiroNome,
              data_agendada: formattedDateBR,
              hora_agendada: scheduledTime,
              link_formulario: link,
              protocolo: visit.protocolo,
            },
          },
        });
        toast.success("SMS enviado com sucesso!");
      } catch (smsError) {
        console.error("Erro ao enviar SMS:", smsError);
        // Não bloqueia o fluxo se o SMS falhar
      }
      
    } catch (error) {
      console.error("Erro ao criar visita:", error);
    }
  };
  
  const handleNewVisit = () => {
    setNome("");
    setWhatsapp("");
    setCidadeId("");
    setLeaderId("");
    setScheduledDate(undefined);
    setScheduledTime("");
    setQrCode(null);
    setVisitCreated(null);
    setSelectedContact(null);
  };
  
  if (visitCreated) {
    const link = generateVisitFormUrl(visitCreated.id);
    
    return (
      <div className="container mx-auto py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-green-600">✓ Visita Agendada com Sucesso!</CardTitle>
            <CardDescription>
              A visita foi agendada e o link do formulário foi enviado por SMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Protocolo</Label>
              <div className="mt-2">
                <ProtocolBadge protocolo={visitCreated.protocolo} />
              </div>
            </div>
            
            <div>
              <Label>Visitante</Label>
              <p className="text-sm mt-1">{visitCreated.contact?.nome}</p>
            </div>
            
            <div>
              <Label>Agendamento</Label>
              <p className="text-sm mt-1 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {format(visitCreated.scheduledDate, "dd/MM/yyyy", { locale: ptBR })} às {visitCreated.scheduledTime}
              </p>
            </div>
            
            <div>
              <Label>Link do Formulário</Label>
              <div className="mt-2 p-3 bg-muted rounded-md break-all text-sm font-mono">
                {link}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  toast.success("Link copiado!");
                }}
              >
                Copiar Link
              </Button>
            </div>
            
            {qrCode && (
              <div>
                <Label className="flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Code
                </Label>
                <div className="mt-2 flex justify-center">
                  <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                </div>
              </div>
            )}
            
            <div className="flex gap-3">
              <Button onClick={handleNewVisit} className="flex-1">
                <UserPlus className="mr-2 h-4 w-4" />
                Nova Visita
              </Button>
              <Button variant="outline" onClick={() => navigate("/office/schedule")}>
                Ver Agenda
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 max-w-2xl">
      <TutorialOverlay page="office-new-visit" />
      <Card data-tutorial="new-visit-form">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Nova Visita ao Gabinete</CardTitle>
              <CardDescription>
                Cadastre rapidamente uma nova visita e gere o link do formulário.
              </CardDescription>
            </div>
            <TutorialButton onClick={restartTutorial} />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2" data-tutorial="new-visit-phone">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <ContactPhoneAutocomplete
                value={whatsapp}
                onPhoneChange={handlePhoneChange}
                onContactSelect={handleContactSelect}
                required
                disabled={createVisit.isPending}
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
                placeholder="Digite o nome completo"
                required
                disabled={createVisit.isPending}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade/RA *</Label>
              <RegionSelect
                value={cidadeId}
                onValueChange={setCidadeId}
                disabled={createVisit.isPending}
                placeholder="Selecione a cidade/RA"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="leader">Líder *</Label>
              <LeaderAutocomplete
                value={leaderId}
                onValueChange={setLeaderId}
                cityId={cidadeId}
                disabled={createVisit.isPending || !cidadeId}
              />
              {!cidadeId && (
                <p className="text-xs text-muted-foreground">
                  Selecione uma cidade primeiro para ver os líderes disponíveis
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4" data-tutorial="new-visit-schedule">
              <div className="space-y-2">
                <Label>Data da Visita *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !scheduledDate && "text-muted-foreground"
                      )}
                      disabled={createVisit.isPending}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {scheduledDate ? format(scheduledDate, "dd/MM/yyyy") : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={setScheduledDate}
                      disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Horário *</Label>
                <Select 
                  value={scheduledTime} 
                  onValueChange={setScheduledTime}
                  disabled={createVisit.isPending}
                >
                  <SelectTrigger>
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <Button
              type="submit"
              className="w-full"
              disabled={createVisit.isPending}
            >
              {createVisit.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Agendar Visita
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
