import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCoordinatorAuth } from "@/contexts/CoordinatorAuthContext";
import { useCoordinatorDashboard } from "@/hooks/coordinator/useCoordinatorDashboard";
import { useCoordinatorCreateEvent, useCoordinatorEvents } from "@/hooks/coordinator/useCoordinatorEvents";
import { useOfficeCities } from "@/hooks/office/useOfficeCities";
import { useEventCategories } from "@/hooks/events/useEventCategories";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Calendar, MapPin, Users, ArrowLeft,
  Copy, Link as LinkIcon, Clock, Eye, UserCheck, Code,
} from "lucide-react";
import { CoordinatorEventDetailsDialog } from "@/components/coordinator/CoordinatorEventDetailsDialog";
import { EventEmbedCodeDialog } from "@/components/coordinator/EventEmbedCodeDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateEventUrl } from "@/lib/eventUrlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";
const logo = "/lovable-uploads/7fcd39d2-d59f-4493-8232-a462c15b3f07.png";

export default function CoordinatorEvents() {
  const tenantDomain = useTenantDomain();
  const { session, isAuthenticated } = useCoordinatorAuth();
  const navigate = useNavigate();
  const { data: dashboard } = useCoordinatorDashboard(session?.leader_id);
  const { data: cities = [] } = useOfficeCities();
  const { data: eventCategories = [] } = useEventCategories();
  const { data: appSettings } = useAppSettings();
  const { data: coordinatorEvents = [] } = useCoordinatorEvents(session?.leader_id);
  const createEvent = useCoordinatorCreateEvent();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<any>(null);
  const [embedEvent, setEmbedEvent] = useState<any>(null);
  const [newEvent, setNewEvent] = useState({
    name: "",
    slug: "",
    description: "",
    date: "",
    time: "",
    location: "",
    address: "",
    capacity: "100",
    categories: [] as string[],
    region: "",
    show_registrations_count: true,
    registration_deadline_hours: 4 as number | null,
  });

  useEffect(() => {
    if (!isAuthenticated) navigate("/coordenador/login", { replace: true });
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated || !session) return null;

  const eventsCreated = coordinatorEvents;

  // Calcula equipe necessária para check-in (1 pessoa a cada 30 participantes esperados)
  const getCheckInStaffNeeded = (registrations: number) => {
    const RATIO = 30;
    const rate = 70; // taxa média padrão de conversão
    const expectedAttendees = Math.round(registrations * (rate / 100));
    return Math.max(1, Math.ceil(expectedAttendees / RATIO));
  };

  // Fixed cover image from affiliate form settings
  const fixedCoverUrl = (appSettings as any)?.affiliate_form_cover_url || null;

  const handleCreateEvent = async () => {
    if (!newEvent.name || !newEvent.slug || !newEvent.date || !newEvent.time || !newEvent.location || newEvent.categories.length === 0 || !newEvent.region) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      await createEvent.mutateAsync({
        coordinatorId: session.leader_id,
        name: newEvent.name,
        slug: newEvent.slug,
        description: newEvent.description,
        date: newEvent.date,
        time: newEvent.time,
        location: newEvent.location,
        address: newEvent.address,
        capacity: parseInt(newEvent.capacity),
        categories: newEvent.categories,
        region: cities.find(c => c.id === newEvent.region)?.nome || newEvent.region,
        coverImageUrl: fixedCoverUrl || undefined,
        show_registrations_count: newEvent.show_registrations_count,
        registration_deadline_hours: newEvent.registration_deadline_hours,
      });

      setNewEvent({
        name: "", slug: "", description: "", date: "", time: "",
        location: "", address: "", capacity: "100", categories: [],
        region: "", show_registrations_count: true, registration_deadline_hours: 4,
      });
      setIsCreateOpen(false);
    } catch (error) {
      console.error("Error creating event:", error);
    }
  };

  const copyEventLink = (slug: string) => {
    const url = `${generateEventUrl(slug, tenantDomain)}?ref=${session.affiliate_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between gap-2 min-h-[48px]">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => navigate("/coordenador/dashboard")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <img src={logo} alt="Logo" className="h-4 shrink-0" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 px-2 sm:px-3 text-xs sm:text-sm shrink-0">
                  <Plus className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Criar Evento</span>
                </Button>
              </DialogTrigger>
            <div className="text-right">
              <p className="font-semibold text-sm truncate">{session.nome_completo}</p>
              <p className="text-xs text-muted-foreground">Meus Eventos</p>
            </div>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Cover image preview (fixed) */}
                {fixedCoverUrl && (
                  <div className="rounded-lg overflow-hidden h-32 bg-muted">
                    <img src={fixedCoverUrl} alt="Capa" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome do Evento *</Label>
                    <Input
                      value={newEvent.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setNewEvent(prev => ({
                          ...prev,
                          name,
                          slug: generateSlug(name),
                        }));
                      }}
                      placeholder="Nome do evento"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Slug (URL)</Label>
                    <Input
                      value={newEvent.slug}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="slug-do-evento"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={newEvent.description}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição do evento"
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={newEvent.date}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Horário *</Label>
                    <Input
                      type="time"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Local *</Label>
                    <Input
                      value={newEvent.location}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Nome do local"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Endereço</Label>
                    <Input
                      value={newEvent.address}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Endereço completo"
                    />
                  </div>
                  <div>
                    <Label>Capacidade</Label>
                    <Input
                      type="number"
                      value={newEvent.capacity}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, capacity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Região *</Label>
                    <Select value={newEvent.region} onValueChange={(v) => setNewEvent(prev => ({ ...prev, region: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {cities.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Categorias *</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {eventCategories.map((cat: any) => (
                        <label key={cat.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                          <Checkbox
                            checked={newEvent.categories.includes(cat.value)}
                            onCheckedChange={(checked) => {
                              setNewEvent(prev => ({
                                ...prev,
                                categories: checked
                                  ? [...prev.categories, cat.value]
                                  : prev.categories.filter(c => c !== cat.value),
                              }));
                            }}
                          />
                          {cat.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Switch
                      checked={newEvent.show_registrations_count}
                      onCheckedChange={(v) => setNewEvent(prev => ({ ...prev, show_registrations_count: v }))}
                    />
                    <Label>Mostrar contador de inscritos</Label>
                  </div>
                  <div className="col-span-2">
                    <Label>Prazo de inscrição (horas antes do evento)</Label>
                    <Input
                      type="number"
                      value={newEvent.registration_deadline_hours ?? ""}
                      onChange={(e) =>
                        setNewEvent(prev => ({
                          ...prev,
                          registration_deadline_hours: e.target.value ? parseInt(e.target.value) : null,
                        }))
                      }
                      placeholder="4"
                    />
                  </div>
                </div>
                <Button onClick={handleCreateEvent} className="w-full" disabled={createEvent.isPending}>
                  {createEvent.isPending ? "Criando..." : "Criar Evento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {eventsCreated.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum evento criado ainda.</p>
              <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Criar Primeiro Evento
              </Button>
            </CardContent>
          </Card>
        ) : (
          eventsCreated.map((ev: any) => {
            const pendingCheckins = (ev.registrations_count || 0) - (ev.checkedin_count || 0);
            return (
              <Card key={ev.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{ev.name}</h3>
                        <Badge
                          variant={ev.status === "active" ? "default" : ev.status === "cancelled" ? "destructive" : "secondary"}
                        >
                          {ev.status === "active" ? "Ativo" : ev.status === "cancelled" ? "Cancelado" : ev.status === "completed" ? "Concluído" : (ev.status || "Sem status")}
                        </Badge>
                        {process.env.NODE_ENV === "development" && <span className="text-[10px] text-muted-foreground">({JSON.stringify(ev.status)})</span>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(ev.date)}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {ev.time}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {ev.location}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm mt-2 flex-wrap">
                        <Badge variant="secondary"><Users className="h-3 w-3 mr-1" /> {ev.registrations_count || 0} inscritos</Badge>
                        <Badge variant="outline" className="gap-1">
                          <UserCheck className="h-3 w-3" /> {ev.checkedin_count || 0} check-ins
                        </Badge>
                        {pendingCheckins > 0 && ev.status === "active" && (
                          <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600">
                            {pendingCheckins} pendente{pendingCheckins !== 1 ? "s" : ""}
                          </Badge>
                        )}
                        {ev.status === "active" && (
                          <Badge
                            variant="outline"
                            className="gap-1 border-orange-500 text-orange-600"
                            title={`Baseado em ${ev.registrations_count || 0} inscritos, taxa média de 70% = ~${Math.round((ev.registrations_count || 0) * 0.7)} pessoas esperadas. 1 atendente a cada 30.`}
                          >
                            <Users className="h-3 w-3" />
                            {getCheckInStaffNeeded(ev.registrations_count || 0)} p/ check-in
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDetailsEvent(ev)}
                    >
                      <Eye className="h-3 w-3 mr-1" /> Ver Detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyEventLink(ev.slug)}
                      disabled={ev.status !== "active"}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEmbedEvent(ev)}
                      disabled={ev.status !== "active"}
                    >
                      <Code className="h-3 w-3 mr-1" /> Embed
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Event Details Dialog */}
      {detailsEvent && (
        <CoordinatorEventDetailsDialog
          event={detailsEvent}
          onClose={() => setDetailsEvent(null)}
        />
      )}

      {/* Embed Code Dialog */}
      {embedEvent && (
        <EventEmbedCodeDialog
          event={embedEvent}
          affiliateToken={session.affiliate_token || undefined}
          open={!!embedEvent}
          onOpenChange={(open) => !open && setEmbedEvent(null)}
        />
      )}
    </div>
  );
}
