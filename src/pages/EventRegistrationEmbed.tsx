import { useParams, useSearchParams } from "react-router-dom";
import { useEvent } from "@/hooks/events/useEvents";
import { useCreateRegistration } from "@/hooks/events/useEventRegistrations";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useLeaderByToken } from "@/hooks/events/useLeaderByToken";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertTriangle, CalendarX2 } from "lucide-react";
import { isEventDeadlinePassed } from "@/lib/eventUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trackLead, pushToDataLayer } from "@/lib/trackingUtils";
import { normalizePhoneToE164 } from "@/utils/phoneNormalizer";
import { MaskedDateInput, parseDateBR, isValidDateBR, isNotFutureDate } from "@/components/ui/masked-date-input";
import { useEventCategories, getCategoryColor } from "@/hooks/events/useEventCategories";

export default function EventRegistrationEmbed() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const affiliateToken = searchParams.get("ref");

  const { data: event, isLoading } = useEvent(slug || "");
  // LocationSelect handles city/location resolution via tenantId
  const { data: leader } = useLeaderByToken(affiliateToken || undefined);
  const { data: categories = [] } = useEventCategories();
  const createRegistration = useCreateRegistration();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    whatsapp: "",
    cidade_id: "",
    localidade: "",
    data_nascimento: "",
    endereco: "",
  });
  const [dataNascimentoDisplay, setDataNascimentoDisplay] = useState("");
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const utmSource = searchParams.get("utm_source") || (affiliateToken ? "affiliate" : "embed");
  const utmMedium = searchParams.get("utm_medium") || "embed";
  const utmCampaign = searchParams.get("utm_campaign") || (slug ? `evento_${slug}` : undefined);
  const utmContent = searchParams.get("utm_content") || undefined;

  // Send height to parent for auto-resize
  useEffect(() => {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "eleitor360-embed-height", height }, "*");
    };
    sendHeight();
    const observer = new MutationObserver(sendHeight);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", sendHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sendHeight);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
        <p className="text-muted-foreground">Evento não encontrado.</p>
      </div>
    );
  }

  const deadlinePassed = isEventDeadlinePassed(event.date, event.time, event.registration_deadline_hours);

  if (event.status !== "active" || deadlinePassed) {
    return (
      <div className="p-6 text-center">
        <CalendarX2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="font-semibold">Inscrições encerradas</p>
        <p className="text-sm text-muted-foreground mt-1">As inscrições para este evento não estão mais disponíveis.</p>
      </div>
    );
  }

  if (registrationSuccess) {
    return (
      <div className="p-6 text-center">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2">Inscrição confirmada!</h3>
        <p className="text-sm text-muted-foreground">Você foi inscrito com sucesso no evento <strong>{event.name}</strong>.</p>
      </div>
    );
  }

  const eventDate = (() => {
    try {
      return format(new Date(event.date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return event.date;
    }
  })();

  const categoryLabels = (event.categories || []).map((catValue: string) => {
    const found = categories.find((c: any) => c.value === catValue);
    return found ? found.label : catValue;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.whatsapp) return;

    try {
      await createRegistration.mutateAsync({
        event_id: event.id,
        nome: formData.nome,
        email: formData.email,
        whatsapp: normalizePhoneToE164(formData.whatsapp),
        cidade_id: formData.cidade_id || undefined,
        localidade: formData.localidade || undefined,
        data_nascimento: formData.data_nascimento || undefined,
        endereco: formData.endereco || undefined,
        leader_id: leader?.id || undefined,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_content: utmContent,
      });
      setRegistrationSuccess(true);
    } catch (error) {
      console.error("Registration error:", error);
    }
  };

  const cityOptions = (cities || []).map((c: any) => ({ value: c.id, label: c.nome }));

  return (
    <div className="p-4 max-w-lg mx-auto font-sans">
      {/* Event Info */}
      <div className="mb-4">
        <h2 className="text-lg font-bold">{event.name}</h2>
        {categoryLabels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {categoryLabels.map((label: string, i: number) => (
              <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{label}</span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-2">
          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {eventDate}</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {event.time}</span>
          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {event.location}</span>
        </div>
        {event.show_registrations_count && event.registrations_count != null && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <Users className="h-3.5 w-3.5" /> {event.registrations_count} inscritos
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label className="text-sm">Nome completo *</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
            placeholder="Seu nome completo"
            required
          />
        </div>
        <div>
          <Label className="text-sm">E-mail *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            placeholder="seu@email.com"
            required
          />
        </div>
        <div>
          <Label className="text-sm">WhatsApp *</Label>
          <Input
            value={formData.whatsapp}
            onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
            placeholder="(00) 00000-0000"
            required
          />
        </div>
        <div>
          <Label className="text-sm">Região</Label>
          <ResponsiveSelect
            options={cityOptions}
            value={formData.cidade_id}
            onValueChange={(v) => setFormData(prev => ({ ...prev, cidade_id: v }))}
            placeholder="Selecione sua região"
          />
        </div>
        <div>
          <Label className="text-sm">Data de Nascimento</Label>
          <MaskedDateInput
            value={dataNascimentoDisplay}
            onChange={(display) => {
              setDataNascimentoDisplay(display);
              if (isValidDateBR(display) && isNotFutureDate(display)) {
                setFormData(prev => ({ ...prev, data_nascimento: parseDateBR(display) }));
              }
            }}
            placeholder="DD/MM/AAAA"
          />
        </div>
        <div>
          <Label className="text-sm">Endereço</Label>
          <Input
            value={formData.endereco}
            onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
            placeholder="Seu endereço"
          />
        </div>
        <Button type="submit" className="w-full" disabled={createRegistration.isPending}>
          {createRegistration.isPending ? "Inscrevendo..." : "Inscrever-se"}
        </Button>
      </form>
    </div>
  );
}
