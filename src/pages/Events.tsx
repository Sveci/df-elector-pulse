import { useState, useMemo, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Plus,
  MapPin,
  Clock,
  Users,
  QrCode,
  Eye,
  Edit,
  Trash2,
  Download,
  UserCheck,
  BarChart3,
  Filter,
  Search,
  Link as LinkIcon,
  Copy,
  Upload,
  UserPlus,
  TrendingUp,
  Award,
  Trophy,
  Target,
  Tag,
  FileSpreadsheet,
  FileText,
  Activity,
  PieChart as PieChartIcon,
  Repeat,
  Camera,
  Crown,
  Code,
  Printer
} from "lucide-react";
import { useEvents } from "@/hooks/events/useEvents";
import { useCreateEvent } from "@/hooks/events/useCreateEvent";
import { useUpdateEvent } from "@/hooks/events/useUpdateEvent";
import { useDeleteEvent } from "@/hooks/events/useDeleteEvent";
import { useEventRegistrations, useUpdateCheckIn } from "@/hooks/events/useEventRegistrations";
import { useQueryClient } from "@tanstack/react-query";
import { useOfficeCities } from "@/hooks/office/useOfficeCities";
import { LocationSelect } from "@/components/office/LocationSelect";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { useEventStats } from "@/hooks/events/useEventStats";
import { useLeadersEventRanking } from "@/hooks/events/useLeadersEventRanking";
import { useCitiesEventStats } from "@/hooks/events/useCitiesEventStats";
import { useRegistrationsTimeline } from "@/hooks/events/useRegistrationsTimeline";
import { useCategoryStats } from "@/hooks/events/useCategoryStats";
import { useEventCategories, getCategoryColor } from "@/hooks/events/useEventCategories";
import { exportEventsToExcel, exportReportsToPdf } from "@/utils/eventReportsExport";
import { generateEventUrl } from "@/lib/eventUrlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import EventQRCode from "@/components/EventQRCode";
import { EventAffiliateDialog } from "@/components/events/EventAffiliateDialog";
import { SendEventPhotosDialog } from "@/components/events/SendEventPhotosDialog";
import { EventEmbedCodeDialog } from "@/components/coordinator/EventEmbedCodeDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

import { useContactsAnalysis } from "@/hooks/events/useContactsAnalysis";

const eventsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="events-header"]',
    title: "Gestão de Eventos",
    content: "Aqui você gerencia todos os eventos da organização. Crie, edite e acompanhe inscrições e check-ins.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="events-create"]',
    title: "Criar Novo Evento",
    content: "Clique aqui para criar um novo evento. Defina nome, data, local, categorias e capacidade.",
    placement: "left",
  },
  {
    target: '[data-tutorial="events-filters"]',
    title: "Filtros de Busca",
    content: "Use os filtros para encontrar eventos por nome, status ou categoria.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="events-list"]',
    title: "Lista de Eventos",
    content: "Visualize todos os seus eventos com informações de inscritos, check-ins e ações disponíveis.",
    placement: "top",
  },
];

const Events = () => {
  const tenantDomain = useTenantDomain();
  const { isDemoMode, m } = useDemoMask();
  const { data: events = [], isLoading } = useEvents();
  const { data: cities = [] } = useOfficeCities();
  const { data: eventStats } = useEventStats();
  const { data: eventCategories = [] } = useEventCategories();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const { isAdmin, isAtendente } = useUserRole();
  const canManageEvents = isAdmin || isAtendente;

  // Calcula equipe necessária para check-in (1 pessoa a cada 30 participantes esperados)
  const getCheckInStaffNeeded = (registrations: number, eventConversionRate?: number) => {
    const RATIO = 30;
    // Usa taxa do evento específico ou taxa média geral
    const rate = eventConversionRate ?? eventStats?.overallConversionRate ?? 70;
    const expectedAttendees = Math.round(registrations * (rate / 100));
    return Math.max(1, Math.ceil(expectedAttendees / RATIO));
  };

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [qrCodeEvent, setQrCodeEvent] = useState<any>(null);
  const [affiliateDialogEvent, setAffiliateDialogEvent] = useState<any>(null);
  const [photosDialogEvent, setPhotosDialogEvent] = useState<any>(null);
  const [embedDialogEvent, setEmbedDialogEvent] = useState<any>(null);
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
    coverImage: null as File | null,
    show_registrations_count: true,
    registration_deadline_hours: 4 as number | null
  });

  const { toast } = useToast();
  const { restartTutorial } = useTutorial("events", eventsTutorialSteps);

  const handleGenerateRegistrationsPDF = async (event: any) => {
    try {
      toast({
        title: "Gerando PDF...",
        description: "Aguarde enquanto a lista é gerada."
      });

      // Fetch registrations for this event
      const { data: registrations, error } = await supabase
        .from("event_registrations")
        .select(`*, cidade:office_cities(nome)`)
        .eq("event_id", event.id);

      if (error) throw error;

      // Separar e ordenar alfabeticamente
      const checkedIn = (registrations || [])
        .filter((r: any) => r.checked_in)
        .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));

      const pending = (registrations || [])
        .filter((r: any) => !r.checked_in)
        .sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || ""));

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();

      // Header
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text(event.name.toUpperCase(), pageWidth / 2, 20, { align: "center" });

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const eventDate = format(new Date(event.date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
      pdf.text(`Data: ${eventDate} às ${event.time} | Local: ${event.location}`, pageWidth / 2, 28, { align: "center" });

      // Estatísticas resumidas
      pdf.setFontSize(10);
      const totalCount = registrations?.length || 0;
      const statsText = `Total: ${totalCount} inscritos | Check-ins: ${checkedIn.length} | Pendentes: ${pending.length}`;
      pdf.text(statsText, pageWidth / 2, 35, { align: "center" });

      // Line separator
      pdf.setDrawColor(200, 200, 200);
      pdf.line(10, 40, pageWidth - 10, 40);

      let y = 48;

      // Função para renderizar header de tabela
      const renderTableHeader = (isCheckedIn: boolean) => {
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text("#", 12, y);
        pdf.text("Nome", 22, y);
        pdf.text("WhatsApp", 72, y);
        pdf.text("Email", 105, y);
        pdf.text("Cidade", 138, y);
        pdf.text("Inscrito em", 165, y);
        if (isCheckedIn) {
          pdf.text("Check-in", 188, y);
        }
        pdf.line(10, y + 2, pageWidth - 10, y + 2);
        pdf.setFont("helvetica", "normal");
        y += 8;
      };

      // Função para renderizar seção
      const renderSection = (title: string, items: any[], isCheckedIn: boolean) => {
        if (items.length === 0) return;

        // Verificar se precisa de nova página para o título da seção
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }

        // Título da seção com fundo cinza
        pdf.setFillColor(240, 240, 240);
        pdf.rect(10, y - 4, pageWidth - 20, 8, "F");
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text(`${title} (${items.length})`, 14, y);
        y += 10;

        // Header da tabela
        renderTableHeader(isCheckedIn);

        // Linhas de dados
        items.forEach((reg: any, index: number) => {
          if (y > 280) {
            pdf.addPage();
            y = 20;
            // Repetir header na nova página
            renderTableHeader(isCheckedIn);
          }

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.text(String(index + 1), 12, y);
          pdf.text((reg.nome || "-").substring(0, 24), 22, y);
          pdf.text((reg.whatsapp || "-").substring(0, 14), 72, y);
          pdf.text((reg.email || "-").substring(0, 18), 105, y);
          pdf.text(((reg.cidade as any)?.nome || "-").substring(0, 12), 138, y);

          // Data de inscrição
          if (reg.created_at) {
            const inscricaoDate = format(new Date(reg.created_at), "dd/MM HH:mm", { locale: ptBR });
            pdf.text(inscricaoDate, 165, y);
          } else {
            pdf.text("-", 165, y);
          }

          // Horário do check-in
          if (isCheckedIn && reg.checked_in_at) {
            const checkTime = format(new Date(reg.checked_in_at), "HH:mm", { locale: ptBR });
            pdf.text(checkTime, 190, y);
          }

          y += 6;
        });

        y += 6; // Espaço entre seções
      };

      // Renderizar seção de check-ins realizados
      renderSection("CHECK-IN REALIZADO", checkedIn, true);

      // Renderizar seção de check-ins pendentes
      renderSection("CHECK-IN PENDENTE", pending, false);

      // Footer com data de geração
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} - Página ${i} de ${totalPages}`,
          pageWidth / 2,
          290,
          { align: "center" }
        );
        pdf.setTextColor(0, 0, 0);
      }

      pdf.save(`inscritos-${event.slug}.pdf`);

      toast({
        title: "PDF gerado!",
        description: `Lista com ${totalCount} inscritos (${checkedIn.length} check-ins, ${pending.length} pendentes).`
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível gerar a lista de inscritos.",
        variant: "destructive"
      });
    }
  };

  const handleCreateEvent = async () => {
    if (!newEvent.name || !newEvent.slug || !newEvent.date || !newEvent.time || !newEvent.location || newEvent.categories.length === 0 || !newEvent.region) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      await createEvent.mutateAsync({
        name: newEvent.name,
        slug: newEvent.slug,
        description: newEvent.description,
        date: newEvent.date,
        time: newEvent.time,
        location: newEvent.location,
        address: newEvent.address,
        capacity: parseInt(newEvent.capacity),
        categories: newEvent.categories,
        region: newEvent.region,
        coverImage: newEvent.coverImage || undefined,
        show_registrations_count: newEvent.show_registrations_count,
        registration_deadline_hours: newEvent.registration_deadline_hours
      });

      setNewEvent({
        name: "",
        slug: "",
        description: "",
        date: "",
        time: "",
        location: "",
        address: "",
        capacity: "100",
        categories: [],
        region: "",
        coverImage: null,
        show_registrations_count: true,
        registration_deadline_hours: 4
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Error creating event:", error);
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent) return;

    try {
      await updateEvent.mutateAsync({
        id: editingEvent.id,
        name: editingEvent.name,
        slug: editingEvent.slug,
        description: editingEvent.description,
        date: editingEvent.date,
        time: editingEvent.time,
        location: editingEvent.location,
        address: editingEvent.address,
        capacity: parseInt(editingEvent.capacity),
        categories: editingEvent.categories,
        region: editingEvent.region,
        status: editingEvent.status,
        coverImage: editingEvent.coverImage || undefined,
        show_registrations_count: editingEvent.show_registrations_count,
        registration_deadline_hours: editingEvent.registration_deadline_hours
      });

      setEditingEvent(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error("Error updating event:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (confirm("Tem certeza que deseja excluir este evento?")) {
      await deleteEvent.mutateAsync(eventId);
    }
  };

  const copyEventLink = (slug: string) => {
    const url = generateEventUrl(slug, tenantDomain);
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copiado!",
      description: "Link do evento copiado para a área de transferência."
    });
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || (event.categories || []).includes(categoryFilter);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getEventCategoryColor = (category: string) => {
    return getCategoryColor(category);
  };

  const getEventCategoryLabel = (category: string) => {
    const cat = eventCategories.find(c => c.value === category || c.label.toLowerCase() === category?.toLowerCase());
    return cat?.label || category;
  };

  const getAttendanceRate = (event: any) => {
    if (event.registrations_count === 0) return 0;
    return Math.round((event.checkedin_count / event.registrations_count) * 100);
  };

  // Resolve region: if it's a UUID (from coordinator portal), find city name
  const getRegionName = (region: string) => {
    if (!region) return "N/A";
    // Check if region looks like a UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(region)) {
      const city = cities.find(c => c.id === region);
      return city?.nome || region;
    }
    return region;
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <TutorialOverlay page="events" />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8" data-tutorial="events-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <PageHeader
                icon={Calendar}
                title="Gestão de Eventos"
                subtitle={`${filteredEvents.length} eventos encontrados`}
              >
                <TutorialButton onClick={restartTutorial} />
              </PageHeader>
            </div>
            {canManageEvents && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-tutorial="events-create">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Evento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Evento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="name">Nome do Evento *</Label>
                      <Input
                        id="name"
                        value={newEvent.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          const slug = name.toLowerCase()
                            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, "");
                          setNewEvent({ ...newEvent, name, slug });
                        }}
                        placeholder="Nome do evento"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="slug">Slug (URL) *</Label>
                      <Input
                        id="slug"
                        value={newEvent.slug}
                        onChange={(e) => setNewEvent({ ...newEvent, slug: e.target.value })}
                        placeholder="evento-exemplo"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URL: {generateEventUrl(newEvent.slug || "slug", tenantDomain)}
                      </p>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={newEvent.description}
                        onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        placeholder="Descrição do evento"
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="date">Data *</Label>
                      <Input
                        id="date"
                        type="date"
                        value={newEvent.date}
                        onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="time">Horário *</Label>
                      <Input
                        id="time"
                        type="time"
                        value={newEvent.time}
                        onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="location">Local *</Label>
                      <Input
                        id="location"
                        value={newEvent.location}
                        onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                        placeholder="Nome do local"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="address">Endereço Completo</Label>
                      <Input
                        id="address"
                        value={newEvent.address}
                        onChange={(e) => setNewEvent({ ...newEvent, address: e.target.value })}
                        placeholder="Endereço completo"
                      />
                    </div>

                    <div>
                      <Label htmlFor="capacity">Capacidade</Label>
                      <Input
                        id="capacity"
                        type="number"
                        value={newEvent.capacity}
                        onChange={(e) => setNewEvent({ ...newEvent, capacity: e.target.value })}
                        placeholder="100"
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Categorias *</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
                        {eventCategories.map((cat) => (
                          <div key={cat.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`create-cat-${cat.value}`}
                              checked={newEvent.categories.includes(cat.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setNewEvent({...newEvent, categories: [...newEvent.categories, cat.value]});
                                } else {
                                  setNewEvent({...newEvent, categories: newEvent.categories.filter(c => c !== cat.value)});
                                }
                              }}
                            />
                            <Label htmlFor={`create-cat-${cat.value}`} className="text-sm font-normal cursor-pointer">{cat.label}</Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-2">
                      <LocationSelect
                        value={undefined}
                        localidadeValue={newEvent.region}
                        onLocationChange={({ cidadeId, localidade }) => {
                          // For events, region is stored as text name
                          if (cidadeId) {
                            const city = cities.find(c => c.id === cidadeId);
                            setNewEvent({ ...newEvent, region: city?.nome || '' });
                          } else {
                            setNewEvent({ ...newEvent, region: localidade || '' });
                          }
                        }}
                        required
                        showLabel
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="coverImage">Imagem de Capa</Label>
                      <Input
                        id="coverImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setNewEvent({ ...newEvent, coverImage: e.target.files?.[0] || null })}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Recomendado: 1920x1080px (16:9)
                      </p>
                    </div>

                    <div className="col-span-2 flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label>Exibir contador de inscritos</Label>
                        <p className="text-xs text-muted-foreground">
                          Mostrar quantas pessoas já se inscreveram na página pública
                        </p>
                      </div>
                      <Switch
                        checked={newEvent.show_registrations_count}
                        onCheckedChange={(checked) => setNewEvent({ ...newEvent, show_registrations_count: checked })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label>Prazo para inscrições</Label>
                      <Select
                        value={String(newEvent.registration_deadline_hours ?? "null")}
                        onValueChange={(v) => setNewEvent({
                          ...newEvent,
                          registration_deadline_hours: v === "null" ? null : parseInt(v)
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hora após o início</SelectItem>
                          <SelectItem value="2">2 horas após o início</SelectItem>
                          <SelectItem value="4">4 horas após o início (padrão)</SelectItem>
                          <SelectItem value="8">8 horas após o início</SelectItem>
                          <SelectItem value="24">24 horas após o início</SelectItem>
                          <SelectItem value="null">Sem limite</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Define até quando as inscrições ficam abertas após o horário de início do evento
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateEvent} disabled={createEvent.isPending}>
                      {createEvent.isPending ? "Criando..." : "Criar Evento"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        <Tabs defaultValue="events" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="checkin">Check-in</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
          </TabsList>

          {/* Lista de Eventos */}
          <TabsContent value="events">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Filtros */}
              <div className="lg:col-span-1" data-tutorial="events-filters">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center text-base">
                      <Filter className="h-5 w-5 mr-2" />
                      Filtros
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Buscar evento</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Nome ou local..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="active">Ativos</SelectItem>
                          <SelectItem value="completed">Concluídos</SelectItem>
                          <SelectItem value="cancelled">Cancelados</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Categoria</Label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {eventCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Grid de Eventos */}
              <div className="lg:col-span-3" data-tutorial="events-list">
                <div className="grid gap-4">
                  {filteredEvents.map((event) => (
                    <Card key={event.id}>
                      <CardContent className="p-6">
                        <div className="flex flex-col md:flex-row gap-4">
                          {/* Imagem */}
                          <div className="w-full md:w-48 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            {event.cover_image_url && !isDemoMode ? (
                              <img
                                src={event.cover_image_url}
                                alt={event.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className={`w-full h-full ${getCategoryColor((event.categories || [])[0] || "")} flex items-center justify-center`}>
                                <Calendar className="h-12 w-12 text-white opacity-50" />
                              </div>
                            )}
                          </div>

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold mb-1 truncate">{isDemoMode ? m.name(event.name) : event.name}</h3>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {(event.categories || []).map((cat: string) => (
                                    <Badge key={cat} className={`${getCategoryColor(cat)} text-white`}>
                                      {getEventCategoryLabel(cat)}
                                    </Badge>
                                  ))}
                                  <Badge variant={event.status === "active" ? "default" : "secondary"}>
                                    {event.status === "active" ? "Ativo" : event.status === "completed" ? "Concluído" : "Cancelado"}
                                  </Badge>
                                  {(event as any).coordinator && (
                                    <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600">
                                      <Crown className="h-3 w-3" />
                                      {(event as any).coordinator.nome_completo}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => setQrCodeEvent(event)}
                                  title="QR Code"
                                >
                                  <QrCode className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => copyEventLink(event.slug)}
                                  title="Copiar link"
                                >
                                  <LinkIcon className="h-4 w-4" />
                                </Button>
                                {canManageEvents && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => {
                                      setEditingEvent({
                                        ...event,
                                        coverImage: null
                                      });
                                      setIsEditDialogOpen(true);
                                    }}
                                    title="Editar"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {canManageEvents && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleDeleteEvent(event.id)}
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-3">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(event.date + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {event.time}
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {isDemoMode ? m.city(event.region) : getRegionName(event.region)}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Users className="h-4 w-4" />
                                <span>{m.number(event.registrations_count || 0, event.id + "_reg")}/{m.number(event.capacity || 0, event.id + "_cap")} inscritos</span>
                              </div>
                              <div className="flex items-center gap-1 text-green-600">
                                <UserCheck className="h-4 w-4" />
                                <span>{m.number(event.checkedin_count || 0, event.id + "_chk")} check-ins</span>
                              </div>
                              <div className="flex items-center gap-1 text-blue-600">
                                <TrendingUp className="h-4 w-4" />
                                <span>{m.percentage(getAttendanceRate(event), event.id + "_att")}% presença</span>
                              </div>
                              <div
                                className="flex items-center gap-1 text-orange-600"
                                title={`Baseado em ${event.registrations_count} inscritos, taxa média de ${Math.round(eventStats?.overallConversionRate ?? 70)}% = ~${Math.round((event.registrations_count || 0) * ((eventStats?.overallConversionRate ?? 70) / 100))} pessoas esperadas. 1 atendente a cada 30.`}
                              >
                                <Users className="h-4 w-4" />
                                <span className="font-medium">{getCheckInStaffNeeded(event.registrations_count || 0)} p/ check-in</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedEventId(event.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver Detalhes e Inscrições
                          </Button>
                          {canManageEvents && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAffiliateDialogEvent(event)}
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                Link do Líder
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerateRegistrationsPDF(event)}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Lista de Inscritos
                              </Button>
                              {(event.status === "active" || event.status === "completed") && (event.checkedin_count || 0) > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setPhotosDialogEvent(event)}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
                                  Enviar Fotos
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEmbedDialogEvent(event)}
                                disabled={event.status !== "active"}
                              >
                                <Code className="h-4 w-4 mr-2" />
                                Embed
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {filteredEvents.length === 0 && (
                    <Card>
                      <CardContent className="p-12 text-center">
                        <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Nenhum evento encontrado</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin">
            <CheckInSection events={events} />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <EventReports events={events} />
          </TabsContent>
        </Tabs>

        {/* Event Details Dialog */}
        {selectedEventId && (
          <EventDetailsDialog
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
          />
        )}

        {/* Edit Event Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Evento</DialogTitle>
            </DialogHeader>
            {editingEvent && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nome do Evento *</Label>
                    <Input
                      value={editingEvent.name}
                      onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Slug (URL) *</Label>
                    <Input
                      value={editingEvent.slug}
                      onChange={(e) => setEditingEvent({ ...editingEvent, slug: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={editingEvent.description || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={editingEvent.date}
                      onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Horário *</Label>
                    <Input
                      type="time"
                      value={editingEvent.time}
                      onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Local *</Label>
                    <Input
                      value={editingEvent.location}
                      onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                      placeholder="Nome do local"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Endereço Completo</Label>
                    <Input
                      value={editingEvent.address || ""}
                      onChange={(e) => setEditingEvent({ ...editingEvent, address: e.target.value })}
                      placeholder="Endereço completo"
                    />
                  </div>

                  <div>
                    <Label>Capacidade</Label>
                    <Input
                      type="number"
                      value={editingEvent.capacity}
                      onChange={(e) => setEditingEvent({ ...editingEvent, capacity: e.target.value })}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Categorias *</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
                      {eventCategories.map((cat) => (
                        <div key={cat.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-cat-${cat.value}`}
                            checked={(editingEvent.categories || []).includes(cat.value)}
                            onCheckedChange={(checked) => {
                              const currentCategories = editingEvent.categories || [];
                              if (checked) {
                                setEditingEvent({...editingEvent, categories: [...currentCategories, cat.value]});
                              } else {
                                setEditingEvent({...editingEvent, categories: currentCategories.filter((c: string) => c !== cat.value)});
                              }
                            }}
                          />
                          <Label htmlFor={`edit-cat-${cat.value}`} className="text-sm font-normal cursor-pointer">{cat.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="col-span-2">
                    <LocationSelect
                      value={undefined}
                      localidadeValue={editingEvent.region}
                      onLocationChange={({ cidadeId, localidade }) => {
                        if (cidadeId) {
                          const city = cities.find(c => c.id === cidadeId);
                          setEditingEvent({ ...editingEvent, region: city?.nome || '' });
                        } else {
                          setEditingEvent({ ...editingEvent, region: localidade || '' });
                        }
                      }}
                      required
                      showLabel
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Imagem de Capa</Label>

                    {editingEvent.cover_image_url && (
                      <div className="mb-2 relative rounded-lg overflow-hidden">
                        <img
                          src={editingEvent.cover_image_url}
                          alt="Cover atual"
                          className="w-full h-40 object-cover"
                        />
                        <Badge className="absolute top-2 left-2 bg-background/80 backdrop-blur">
                          Imagem atual
                        </Badge>
                      </div>
                    )}

                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setEditingEvent({
                        ...editingEvent,
                        coverImage: e.target.files?.[0] || null
                      })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Selecione uma nova imagem para substituir a atual (Recomendado: 1920x1080px)
                    </p>
                  </div>

                  <div className="col-span-2">
                    <Label>Status</Label>
                    <Select
                      value={editingEvent.status}
                      onValueChange={(value) => setEditingEvent({ ...editingEvent, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>Exibir contador de inscritos</Label>
                      <p className="text-xs text-muted-foreground">
                        Mostrar quantas pessoas já se inscreveram na página pública
                      </p>
                    </div>
                    <Switch
                      checked={editingEvent.show_registrations_count ?? true}
                      onCheckedChange={(checked) => setEditingEvent({ ...editingEvent, show_registrations_count: checked })}
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Prazo para inscrições</Label>
                    <Select
                      value={String(editingEvent.registration_deadline_hours ?? "null")}
                      onValueChange={(v) => setEditingEvent({
                        ...editingEvent,
                        registration_deadline_hours: v === "null" ? null : parseInt(v)
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hora após o início</SelectItem>
                        <SelectItem value="2">2 horas após o início</SelectItem>
                        <SelectItem value="4">4 horas após o início (padrão)</SelectItem>
                        <SelectItem value="8">8 horas após o início</SelectItem>
                        <SelectItem value="24">24 horas após o início</SelectItem>
                        <SelectItem value="null">Sem limite</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define até quando as inscrições ficam abertas após o horário de início do evento
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateEvent} disabled={updateEvent.isPending}>
                    {updateEvent.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={!!qrCodeEvent} onOpenChange={() => setQrCodeEvent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>QR Code - {qrCodeEvent?.name}</DialogTitle>
            </DialogHeader>
            {qrCodeEvent && (
              <EventQRCode event={qrCodeEvent} />
            )}
          </DialogContent>
        </Dialog>

        {/* Affiliate Link Dialog */}
        {affiliateDialogEvent && (
          <EventAffiliateDialog
            event={affiliateDialogEvent}
            open={!!affiliateDialogEvent}
            onOpenChange={(open) => !open && setAffiliateDialogEvent(null)}
          />
        )}

        {/* Send Photos Dialog */}
        <SendEventPhotosDialog
          open={!!photosDialogEvent}
          onOpenChange={(open) => !open && setPhotosDialogEvent(null)}
          event={photosDialogEvent}
        />

        {/* Embed Code Dialog */}
        {embedDialogEvent && (
          <EventEmbedCodeDialog
            event={embedDialogEvent}
            open={!!embedDialogEvent}
            onOpenChange={(open) => !open && setEmbedDialogEvent(null)}
          />
        )}
      </div>
    </div>
  );
};

// Event Details Dialog Component
function EventDetailsDialog({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { isDemoMode, m } = useDemoMask();
  const { data: registrations = [], isLoading } = useEventRegistrations(eventId);
  const updateCheckIn = useUpdateCheckIn();
  const { data: events = [] } = useEvents();
  const { toast } = useToast();
  const event = events.find(e => e.id === eventId);

  const filteredRegistrations = registrations.filter((reg: any) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      reg.nome?.toLowerCase().includes(search) ||
      reg.email?.toLowerCase().includes(search) ||
      reg.whatsapp?.includes(search)
    );
  });

  if (!event) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* PIN de Check-in */}
          {event.checkin_pin && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">PIN para Check-in</p>
                      <p className="text-2xl font-bold font-mono tracking-widest">{event.checkin_pin}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(event.checkin_pin);
                      toast({
                        title: "PIN copiado!",
                        description: "Compartilhe com quem fará os check-ins no evento."
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar PIN
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Compartilhe este PIN com quem fará os check-ins. Não é necessário criar conta.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Inscritos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{m.number(event.registrations_count || 0, "det_reg")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Check-ins</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{m.number(event.checkedin_count || 0, "det_chk")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Vagas Restantes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{m.number((event.capacity || 0) - (event.registrations_count || 0), "det_vag")}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Inscrições</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-center text-muted-foreground py-4">Carregando...</p>
              ) : registrations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhuma inscrição ainda</p>
              ) : filteredRegistrations.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Nenhum resultado para "{searchTerm}"</p>
              ) : (
                <div className="space-y-2">
                  {searchTerm && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {filteredRegistrations.length} resultado(s) encontrado(s)
                    </p>
                  )}
                  {filteredRegistrations.map((reg: any) => (
                    <div key={reg.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{m.name(reg.nome)}</p>
                        <p className="text-sm text-muted-foreground">{m.email(reg.email)}</p>
                        <p className="text-xs text-muted-foreground">{m.phone(reg.whatsapp)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {reg.checked_in ? (
                          <Badge variant="default" className="bg-green-500">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Check-in feito
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateCheckIn.mutate({ id: reg.id, checked_in: true })}
                          >
                            Fazer Check-in
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Check-in Section Component
function CheckInSection({ events }: { events: any[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const { isDemoMode, m } = useDemoMask();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const { data: registrations = [], isLoading } = useEventRegistrations(selectedEventId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Realtime subscription for check-in updates
  useEffect(() => {
    if (!selectedEventId) return;

    const channel = supabase
      .channel(`checkin-realtime-${selectedEventId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_registrations',
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["event_registrations", selectedEventId] });
          queryClient.invalidateQueries({ queryKey: ["events"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, queryClient]);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const checkedInList = registrations.filter((r: any) => r.checked_in).sort((a: any, b: any) => {
    // Most recent check-in first
    const aTime = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0;
    const bTime = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0;
    return bTime - aTime;
  });
  const checkedInCount = checkedInList.length;
  const pendingCount = registrations.length - checkedInCount;

  const filteredRegistrations = registrations.filter((reg: any) =>
    reg.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePrintLabel = useCallback((reg: any) => {
    const eventName = selectedEvent?.name || "Evento";
    const eventDate = selectedEvent?.date
      ? format(new Date(selectedEvent.date), "dd/MM/yyyy", { locale: ptBR })
      : "";

    const cityName = reg.cidade?.nome || reg.localidade || "";

    // Open a print window with label-sized content
    const printWindow = window.open("", "_blank", "width=400,height=300");
    if (!printWindow) {
      toast({ title: "Erro", description: "Permita pop-ups para imprimir etiquetas.", variant: "destructive" });
      return;
    }

    const checkinTime = reg.checked_in_at
      ? format(new Date(reg.checked_in_at), "HH:mm", { locale: ptBR })
      : format(new Date(), "HH:mm", { locale: ptBR });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta - ${reg.nome}</title>
        <style>
          @page {
            size: 100mm 40mm;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: 100mm;
            height: 40mm;
            font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
            padding: 2.5mm 2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 0.6pt solid #222;
            padding-bottom: 1.5mm;
          }
          .event-name {
            font-size: 6.5pt;
            font-weight: 600;
            color: #333;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
            max-width: 55mm;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .event-date {
            font-size: 6pt;
            color: #666;
            white-space: nowrap;
          }
          .main {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 1mm 0;
          }
          .name {
            font-size: 15pt;
            font-weight: 700;
            line-height: 1.15;
            color: #111;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .city {
            font-size: 8.5pt;
            color: #444;
            margin-top: 0.8mm;
            font-weight: 500;
          }
          .footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top: 0.4pt solid #ccc;
            padding-top: 1mm;
          }
          .badge {
            font-size: 5.5pt;
            background: #222;
            color: #fff;
            padding: 0.4mm 1.5mm;
            border-radius: 1mm;
            text-transform: uppercase;
            letter-spacing: 0.4pt;
            font-weight: 600;
          }
          .checkin-time {
            font-size: 5.5pt;
            color: #888;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="event-name">${eventName}</div>
          <div class="event-date">${eventDate}</div>
        </div>
        <div class="main">
          <div class="name">${reg.nome}</div>
          ${cityName ? `<div class="city">📍 ${cityName}</div>` : ""}
        </div>
        <div class="footer">
          <div class="badge">✓ Credenciado</div>
          <div class="checkin-time">Check-in: ${checkinTime}</div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();

    // Wait for content to render then trigger print
    setTimeout(() => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    }, 250);
  }, [selectedEvent, toast]);

  const handleExportCheckInPDF = () => {
    if (!selectedEvent || registrations.length === 0) {
      toast({
        title: "Sem inscrições",
        description: "Não há inscrições para exportar.",
        variant: "destructive"
      });
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Lista de Check-in", pageWidth / 2, yPos, { align: "center" });
    yPos += 10;

    doc.setFontSize(14);
    doc.text(selectedEvent.name, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const eventDate = selectedEvent.date ? format(new Date(selectedEvent.date), "dd/MM/yyyy", { locale: ptBR }) : "";
    doc.text(`${eventDate} às ${selectedEvent.time || ""} - ${selectedEvent.location || ""}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 4, pageWidth - 28, 14, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Total: ${registrations.length}  |  Check-ins: ${checkedInCount}  |  Pendentes: ${pendingCount}`, pageWidth / 2, yPos + 4, { align: "center" });
    yPos += 18;

    const checkedIn = registrations.filter((r: any) => r.checked_in).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
    const pending = registrations.filter((r: any) => !r.checked_in).sort((a: any, b: any) => a.nome.localeCompare(b.nome));

    const addSection = (title: string, items: any[], isCheckedIn: boolean) => {
      if (items.length === 0) return;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      if (isCheckedIn) {
        doc.setTextColor(34, 139, 34);
      } else {
        doc.setTextColor(200, 150, 0);
      }
      doc.text(`${title} (${items.length})`, 14, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 6;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(isCheckedIn ? 220 : 255, isCheckedIn ? 255 : 250, isCheckedIn ? 220 : 220);
      doc.rect(14, yPos - 4, pageWidth - 28, 8, "F");
      doc.text("#", 16, yPos);
      doc.text("Nome", 26, yPos);
      doc.text("WhatsApp", 80, yPos);
      doc.text("Email", 115, yPos);
      doc.text("Inscrito em", 155, yPos);
      if (isCheckedIn) {
        doc.text("Check-in", 185, yPos);
      }
      yPos += 6;

      doc.setFont("helvetica", "normal");
      items.forEach((reg: any, index: number) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        const bgColor = index % 2 === 0 ? 250 : 255;
        doc.setFillColor(bgColor, bgColor, bgColor);
        doc.rect(14, yPos - 4, pageWidth - 28, 7, "F");

        doc.text(String(index + 1), 16, yPos);
        doc.text(reg.nome?.substring(0, 26) || "", 26, yPos);
        doc.text(reg.whatsapp?.substring(0, 14) || "", 80, yPos);
        doc.text(reg.email?.substring(0, 22) || "", 115, yPos);

        if (reg.created_at) {
          const inscricaoDate = format(new Date(reg.created_at), "dd/MM HH:mm", { locale: ptBR });
          doc.text(inscricaoDate, 155, yPos);
        } else {
          doc.text("-", 155, yPos);
        }

        if (isCheckedIn && reg.checked_in_at) {
          const checkTime = format(new Date(reg.checked_in_at), "HH:mm", { locale: ptBR });
          doc.text(checkTime, 187, yPos);
        }

        yPos += 7;
      });

      yPos += 8;
    };

    addSection("✓ Check-in Realizado", checkedIn, true);
    addSection("○ Aguardando Check-in", pending, false);

    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 285, { align: "center" });

    doc.save(`checkin-${selectedEvent.slug || "evento"}.pdf`);
    toast({
      title: "PDF gerado",
      description: "A lista de check-in foi exportada com sucesso."
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Buscar Inscrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Selecione o Evento</Label>
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um evento" />
              </SelectTrigger>
              <SelectContent>
                {events.filter(e => e.status === "active").map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedEventId && (
            <>
              <div className="flex justify-between items-center pt-2">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{registrations.length}</span> inscritos •
                  <span className="text-green-600 font-medium ml-1">{checkedInCount}</span> check-ins •
                  <span className="text-amber-600 font-medium ml-1">{pendingCount}</span> pendentes
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCheckInPDF}
                  disabled={registrations.length === 0}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir Lista
                </Button>
              </div>

              <div>
                <Label>Buscar Participante</Label>
                <Input
                  placeholder="Nome ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Realtime checked-in list */}
      {selectedEventId && checkedInList.length > 0 && (
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              Check-ins em Tempo Real
              <Badge variant="secondary" className="ml-auto text-xs">{checkedInCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {checkedInList.map((reg: any) => (
                <div key={reg.id} className="flex items-center justify-between p-3 border border-green-100 dark:border-green-900 rounded-lg bg-green-50/50 dark:bg-green-950/20">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.name(reg.nome)}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {reg.cidade?.nome && <span>{reg.cidade.nome}</span>}
                      {reg.localidade && !reg.cidade?.nome && <span>{reg.localidade}</span>}
                      {reg.checked_in_at && (
                        <span className="text-green-600">
                          ✓ {format(new Date(reg.checked_in_at), "HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 gap-1.5"
                    onClick={() => handlePrintLabel(reg)}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Etiqueta
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedEventId && (
        <div className="grid gap-4">
          {filteredRegistrations.map((reg: any) => (
            <Card key={reg.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{m.name(reg.nome)}</p>
                    <p className="text-sm text-muted-foreground">{m.email(reg.email)}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {reg.created_at && (
                        <span>
                          Inscrito em: {format(new Date(reg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                      {reg.checked_in && reg.checked_in_at && (
                        <span className="text-green-600">
                          Check-in: {format(new Date(reg.checked_in_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reg.checked_in && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePrintLabel(reg)}
                        title="Imprimir etiqueta"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    <Badge variant={reg.checked_in ? "default" : "secondary"} className={reg.checked_in ? "bg-green-500" : ""}>
                      {reg.checked_in ? "Check-in feito" : "Aguardando"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Reports Component
function EventReports({ events }: { events: any[] }) {
  const [timelinePeriod, setTimelinePeriod] = useState(30);
  const { isDemoMode, m } = useDemoMask();
  const { data: stats } = useEventStats();
  const { data: leadersRanking } = useLeadersEventRanking();
  const { data: citiesStats } = useCitiesEventStats();
  const { data: categoryStats } = useCategoryStats();
  const { data: contactsAnalysis } = useContactsAnalysis();
  const { data: timelineData } = useRegistrationsTimeline(timelinePeriod);
  const { data: eventCategories = [] } = useEventCategories();
  const { toast } = useToast();

  const categoryCounts = events.reduce((acc, event) => {
    acc[event.category] = (acc[event.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getConversionColor = (rate: number) => {
    if (rate >= 70) return "text-success-500";
    if (rate >= 50) return "text-warning-500";
    return "text-danger-500";
  };

  const getConversionBg = (rate: number) => {
    if (rate >= 70) return "bg-success-500";
    if (rate >= 50) return "bg-warning-500";
    return "bg-danger-500";
  };

  const handleExportExcel = () => {
    if (!stats || !leadersRanking || !citiesStats || !categoryStats) {
      toast({
        title: "Erro",
        description: "Dados ainda carregando. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      exportEventsToExcel({
        events,
        leadersRanking,
        citiesStats,
        categoryStats,
        stats,
      });
      toast({
        title: "Excel exportado",
        description: "Relatório baixado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o arquivo Excel.",
        variant: "destructive",
      });
    }
  };

  const handleExportPdf = () => {
    if (!stats || !leadersRanking) {
      toast({
        title: "Erro",
        description: "Dados ainda carregando. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      exportReportsToPdf({
        stats,
        events,
        leadersRanking,
      });
      toast({
        title: "PDF exportado",
        description: "Relatório baixado com sucesso!",
      });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: "Não foi possível gerar o arquivo PDF.",
        variant: "destructive",
      });
    }
  };

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

  return (
    <div className="grid gap-6">
      {/* Botões de Exportação */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleExportExcel} variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
        <Button onClick={handleExportPdf} variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Dashboard Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{m.number(stats?.totalEvents || 0, "rep_total")}</div>
            <p className="text-xs text-muted-foreground">
              {m.number(stats?.activeEvents || 0, "rep_active")} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão Geral</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {m.percentage(parseFloat(stats?.overallConversionRate.toFixed(1) || "0"), "rep_conv")}%
            </div>
            <p className="text-xs text-muted-foreground">
              {m.number(stats?.totalCheckins || 0, "rep_chk")} de {m.number(stats?.totalRegistrations || 0, "rep_ins")} inscrições
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacidade Média</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {m.percentage(parseFloat(stats?.averageCapacityUtilization.toFixed(1) || "0"), "rep_caputil")}%
            </div>
            <p className="text-xs text-muted-foreground">
              Utilização média dos eventos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eventos por Categoria</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(categoryCounts).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{eventCategories.find(c => c.value === category)?.label || category}</span>
                  <span className="font-medium">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Destaques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-primary-500" />
              Evento Mais Popular
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.mostPopularEvent ? (
              <div>
                <p className="font-semibold text-lg">{isDemoMode ? m.name(stats.mostPopularEvent.name) : stats.mostPopularEvent.name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.number(stats.mostPopularEvent.registrations, "pop_reg")} inscrições
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento cadastrado</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-5 w-5 text-success-500" />
              Melhor Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.bestConversionEvent ? (
              <div>
                <p className="font-semibold text-lg">{isDemoMode ? m.name(stats.bestConversionEvent.name) : stats.bestConversionEvent.name}</p>
                <p className="text-sm text-muted-foreground">
                  {m.percentage(parseFloat(stats.bestConversionEvent.rate.toFixed(1)), "best_conv")}% de conversão
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum evento cadastrado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evolução Temporal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Evolução de Inscrições
            </CardTitle>
            <Select value={timelinePeriod.toString()} onValueChange={(v) => setTimelinePeriod(Number(v))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {timelineData && timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => format(new Date(date), "dd/MM")}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  labelFormatter={(date) => format(new Date(date), "dd/MM/yyyy")}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  name="Inscrições"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="checkins"
                  name="Check-ins"
                  stroke="hsl(var(--success-500))"
                  fill="hsl(var(--success-500))"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum dado disponível para o período selecionado
            </p>
          )}
        </CardContent>
      </Card>

      {/* Métricas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Métricas Detalhadas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryStats && categoryStats.length > 0 ? (
            <div className="space-y-6">
              {/* Gráfico de Barras */}
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="categoryLabel"
                    width={120}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="totalRegistrations" name="Inscrições" fill="hsl(var(--primary))" />
                  <Bar dataKey="totalCheckins" name="Check-ins" fill="hsl(var(--success-500))" />
                </BarChart>
              </ResponsiveContainer>

              {/* Tabela Detalhada */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Categoria</th>
                      <th className="text-right py-2 font-medium">Eventos</th>
                      <th className="text-right py-2 font-medium">Inscrições</th>
                      <th className="text-right py-2 font-medium">Check-ins</th>
                      <th className="text-right py-2 font-medium">Taxa</th>
                      <th className="text-right py-2 font-medium">Média/Evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryStats.map((cat) => (
                      <tr key={cat.category} className="border-b">
                        <td className="py-3 font-medium">{cat.categoryLabel}</td>
                        <td className="py-3 text-right">{m.number(cat.totalEvents, cat.category + "_te")}</td>
                        <td className="py-3 text-right">{m.number(cat.totalRegistrations, cat.category + "_tr")}</td>
                        <td className="py-3 text-right">{m.number(cat.totalCheckins, cat.category + "_tc")}</td>
                        <td className={`py-3 text-right font-medium ${getConversionColor(cat.conversionRate)}`}>
                          {m.percentage(parseFloat(cat.conversionRate.toFixed(1)), cat.category + "_cr")}%
                        </td>
                        <td className="py-3 text-right">
                          {m.number(parseFloat(cat.averageRegistrationsPerEvent.toFixed(1)), cat.category + "_avg")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma categoria encontrada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Taxa de Conversão por Evento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Taxa de Conversão por Evento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.map((event) => {
              const registrations = event.registrations_count || 0;
              const checkins = event.checkedin_count || 0;
              const rate = registrations > 0 ? (checkins / registrations) * 100 : 0;

              return (
                <div key={event.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{isDemoMode ? m.name(event.name) : event.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.number(checkins, event.id + "_rchk")} de {m.number(registrations, event.id + "_rreg")} confirmados
                      </p>
                    </div>
                    <span className={`text-lg font-bold ${getConversionColor(rate)}`}>
                      {rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getConversionBg(rate)}`}
                      style={{ width: `${Math.min(rate, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Análise de Contatos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Análise de Contatos (Novos vs Recorrentes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contactsAnalysis ? (
            <div className="space-y-6">
              {/* Métricas Principais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{m.number(contactsAnalysis.totalUniqueContacts, "ca_total")}</p>
                  <p className="text-sm text-muted-foreground">Contatos Únicos</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{m.number(contactsAnalysis.newContacts, "ca_new")}</p>
                  <p className="text-sm text-muted-foreground">Novos (1 evento)</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{m.number(contactsAnalysis.recurringContacts, "ca_rec")}</p>
                  <p className="text-sm text-muted-foreground">Recorrentes (2+)</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{m.percentage(parseFloat(contactsAnalysis.recurrenceRate.toFixed(1)), "ca_rate")}%</p>
                  <p className="text-sm text-muted-foreground">Taxa de Recorrência</p>
                </div>
              </div>

              {/* Gráfico de Pizza */}
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Novos', value: contactsAnalysis.newContacts },
                        { name: 'Recorrentes', value: contactsAnalysis.recurringContacts },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) =>
                        `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                      }
                      outerRadius={100}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {[
                        { name: 'Novos', value: contactsAnalysis.newContacts },
                        { name: 'Recorrentes', value: contactsAnalysis.recurringContacts },
                      ].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top Participantes Engajados */}
              {contactsAnalysis.topRecurringContacts.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Top 10 Participantes Mais Engajados</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">#</th>
                          <th className="text-left py-2 font-medium">Nome</th>
                          <th className="text-right py-2 font-medium">Eventos Participados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contactsAnalysis.topRecurringContacts.map((contact, index) => (
                          <tr key={contact.contactId} className="border-b">
                            <td className="py-3 text-muted-foreground">{index + 1}</td>
                            <td className="py-3 font-medium">{m.name(contact.name)}</td>
                            <td className="py-3 text-right">{contact.eventCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum dado disponível
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Líderes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ranking de Líderes por Inscrições
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leadersRanking && leadersRanking.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">#</th>
                    <th className="text-left py-2 font-medium">Líder</th>
                    <th className="text-left py-2 font-medium">Cidade</th>
                    <th className="text-right py-2 font-medium">Inscrições</th>
                    <th className="text-right py-2 font-medium">Check-ins</th>
                    <th className="text-right py-2 font-medium">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {leadersRanking.map((leader, index) => (
                    <tr key={leader.leaderId} className="border-b">
                      <td className="py-3 text-muted-foreground">{index + 1}</td>
                      <td className="py-3 font-medium">{m.name(leader.leaderName)}</td>
                      <td className="py-3 text-muted-foreground">
                        {m.city(leader.cityName) || "-"}
                      </td>
                      <td className="py-3 text-right">{m.number(leader.registrations, leader.leaderId + "_lreg")}</td>
                      <td className="py-3 text-right">{m.number(leader.checkins, leader.leaderId + "_lchk")}</td>
                      <td className={`py-3 text-right font-medium ${getConversionColor(leader.conversionRate)}`}>
                        {m.percentage(parseFloat(leader.conversionRate.toFixed(1)), leader.leaderId + "_lconv")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma inscrição via líder encontrada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Distribuição por Cidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Inscrições por Cidade/RA
          </CardTitle>
        </CardHeader>
        <CardContent>
          {citiesStats && citiesStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Cidade</th>
                    <th className="text-right py-2 font-medium">Inscrições</th>
                    <th className="text-right py-2 font-medium">Check-ins</th>
                    <th className="text-right py-2 font-medium">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {citiesStats.map((city) => (
                    <tr key={city.cityId} className="border-b">
                      <td className="py-3 font-medium">{m.city(city.cityName)}</td>
                      <td className="py-3 text-right">{m.number(city.registrations, city.cityId + "_creg")}</td>
                      <td className="py-3 text-right">{m.number(city.checkins, city.cityId + "_cchk")}</td>
                      <td className={`py-3 text-right font-medium ${getConversionColor(city.conversionRate)}`}>
                        {m.percentage(parseFloat(city.conversionRate.toFixed(1)), city.cityId + "_cconv")}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma inscrição com cidade encontrada
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Events;
