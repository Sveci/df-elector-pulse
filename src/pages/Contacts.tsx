import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRegions } from "@/hooks/useRegions";
import { useTenantLocationConfig } from "@/hooks/useTenantLocationConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportContactsExcelDialog } from "@/components/contacts/ImportContactsExcelDialog";
import { EditContactDialog } from "@/components/contacts/EditContactDialog";
import { ImportEmailsDialog } from "@/components/contacts/ImportEmailsDialog";
import { VerificationSummaryCard } from "@/components/contacts/VerificationSummaryCard";
import { useIdentifyGenders } from "@/hooks/contacts/useIdentifyGenders";
import { useContactEventParticipation } from "@/hooks/contacts/useContactEventParticipation";
import { useContactPageViews } from "@/hooks/contacts/useContactPageViews";
import { useContactDownloads } from "@/hooks/contacts/useContactDownloads";
import { useContactActivityLog } from "@/hooks/contacts/useContactActivityLog";
import { useContactCommunications } from "@/hooks/contacts/useContactCommunications";
import { useContactVisits } from "@/hooks/contacts/useContactVisits";
import { useContactSurveyParticipation } from "@/hooks/contacts/useContactSurveyParticipation";
import { formatPhoneToBR } from "@/utils/phoneNormalizer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Users,
  Phone,
  Mail,
  MapPin,
  Search,
  Eye,
  Calendar,
  UserCheck,
  Clock,
  Edit,
  Sparkles,
  Loader2,
  FileSpreadsheet,
  Megaphone,
  Download,
  Building2,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  FileText,
  ExternalLink,
  Filter,
  X,
  UserMinus,
  UserPlus,
  Ban,
  Crown,
  History,
  MessageSquare,
  Send,
  CheckCheck,
  Check,
  AlertCircle,
  Briefcase,
  Cake,
  ClipboardList,
  Smartphone,
} from "lucide-react";
import { DeactivateContactDialog } from "@/components/contacts/DeactivateContactDialog";
import { useReactivateContact } from "@/hooks/contacts/useDeactivateContact";
import { useUserRole } from "@/hooks/useUserRole";
import { resendVerificationSMS } from "@/hooks/contacts/useContactVerification";
import { useAuth } from "@/contexts/AuthContext";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { DEMO_CONTACTS, DEMO_CONTACTS_STATS } from "@/data/contacts/demoContacts";

const contactsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="contacts-header"]',
    title: "Base de Contatos",
    content: "Gerencie todos os contatos cadastrados no sistema. Visualize origem, status de verificação e informações detalhadas.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="contacts-stats"]',
    title: "Estatísticas",
    content: "Acompanhe o total de contatos, quantos têm WhatsApp e quantos têm email cadastrado.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="contacts-filters"]',
    title: "Filtros Avançados",
    content: "Filtre contatos por região, origem (evento, líder, captação), status de verificação e muito mais.",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="contacts-actions"]',
    title: "Ações em Massa",
    content: "Importe contatos via Excel ou identifique gêneros automaticamente usando IA.",
    placement: "left",
  },
];

// Cores e labels para badges de origem
const sourceConfig: Record<string, { label: string; className: string; icon: typeof Calendar }> = {
  evento: {
    label: "Evento",
    className: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Calendar,
  },
  lider: {
    label: "Líder",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: UserCheck,
  },
  manual: {
    label: "Importação",
    className: "bg-gray-50 text-gray-600 border-gray-200",
    icon: FileSpreadsheet,
  },
  captacao: {
    label: "Captação",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Megaphone,
  },
  visita: {
    label: "Visita",
    className: "bg-teal-50 text-teal-700 border-teal-200",
    icon: Building2,
  },
  webhook: {
    label: "Webhook",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
    icon: ExternalLink,
  },
  whatsapp: {
    label: "WhatsApp",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: MessageSquare,
  },
  pesquisa: {
    label: "Pesquisa",
    className: "bg-violet-50 text-violet-700 border-violet-200",
    icon: ClipboardList,
  },
};

// Função para gerar cor de avatar baseada no nome
const getAvatarColor = (name: string) => {
  const colors = [
    { bg: "from-blue-100 to-blue-200", text: "text-blue-700" },
    { bg: "from-purple-100 to-purple-200", text: "text-purple-700" },
    { bg: "from-emerald-100 to-emerald-200", text: "text-emerald-700" },
    { bg: "from-amber-100 to-amber-200", text: "text-amber-700" },
    { bg: "from-rose-100 to-rose-200", text: "text-rose-700" },
    { bg: "from-cyan-100 to-cyan-200", text: "text-cyan-700" },
    { bg: "from-indigo-100 to-indigo-200", text: "text-indigo-700" },
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const Contacts = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const ITEMS_PER_PAGE = 50;

  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedLeaderId, setSelectedLeaderId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [deactivatingContact, setDeactivatingContact] = useState<{ id: string; name: string } | null>(null);

  const { restartTutorial } = useTutorial("contacts", contactsTutorialSteps);

  const identifyGenders = useIdentifyGenders();
  const reactivateContact = useReactivateContact();
  const { isAdmin } = useUserRole();
  const { user } = useAuth();
  const { isDemoMode, m } = useDemoMask();
  const locationConfig = useTenantLocationConfig();

  // Buscar contact_ids que foram promovidos a líder
  const { data: promotedContactIds = [] } = useQuery({
    queryKey: ["promoted-contact-ids"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_activity_log")
        .select("contact_id")
        .eq("action", "promoted_to_leader");

      if (error) throw error;
      return [...new Set((data || []).map((r) => r.contact_id))];
    },
  });

  // Buscar líderes ativos para o filtro
  const { data: leadersForFilter = [] } = useQuery({
    queryKey: ["leaders-for-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lideres")
        .select("id, nome_completo")
        .eq("is_active", true)
        .order("nome_completo");
      return data || [];
    },
  });

  // Buscar eventos para o filtro
  const { data: eventsForFilter = [] } = useQuery({
    queryKey: ["events-for-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, name").order("date", { ascending: false });
      return data || [];
    },
  });

  // Buscar funis de captação para o filtro
  const { data: funnelsForFilter = [] } = useQuery({
    queryKey: ["funnels-for-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("lead_funnels").select("id, nome").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Buscar contact_ids que participaram de eventos
  const { data: eventParticipantIds = [] } = useQuery({
    queryKey: ["event-participant-contact-ids", sourceFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("contact_id")
        .not("contact_id", "is", null);

      if (error) throw error;
      return [...new Set((data || []).map((r) => r.contact_id))];
    },
    enabled: sourceFilter === "evento",
  });

  // Buscar contact_ids de um evento específico
  const { data: specificEventContactIds = [] } = useQuery({
    queryKey: ["specific-event-contact-ids", selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];

      const { data, error } = await supabase
        .from("event_registrations")
        .select("contact_id")
        .eq("event_id", selectedEventId)
        .not("contact_id", "is", null);

      if (error) throw error;
      return [...new Set((data || []).map((r) => r.contact_id))];
    },
    enabled: sourceFilter === "evento" && !!selectedEventId,
  });

  // Buscar contatos reais do banco
  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { count } = await supabase.from("office_contacts").select("*", { count: "exact", head: true });

      const totalRecords = count || 0;
      const batchSize = 1000;
      const batches = Math.ceil(totalRecords / batchSize);

      const batchPromises = [];
      for (let i = 0; i < batches; i++) {
        batchPromises.push(
          supabase
            .from("office_contacts")
            .select(
              `
              *,
              cidade:office_cities(id, nome, codigo_ra)
            `,
            )
            .order("created_at", { ascending: false })
            .range(i * batchSize, (i + 1) * batchSize - 1),
        );
      }

      const results = await Promise.all(batchPromises);
      const data = results.flatMap((r) => r.data || []);

      const errorBatch = results.find((r) => r.error);
      if (errorBatch?.error) throw errorBatch.error;

      const liderIds = data?.filter((c) => c.source_type === "lider" && c.source_id).map((c) => c.source_id) || [];
      const campanhaIds =
        data?.filter((c) => c.source_type === "campanha" && c.source_id).map((c) => c.source_id) || [];
      const eventoIds = data?.filter((c) => c.source_type === "evento" && c.source_id).map((c) => c.source_id) || [];
      const captacaoIds =
        data?.filter((c) => c.source_type === "captacao" && c.source_id).map((c) => c.source_id) || [];
      const visitaIds = data?.filter((c) => c.source_type === "visita" && c.source_id).map((c) => c.source_id) || [];

      const [lideresData, campanhasData, eventosData, captacaoCampanhasData, visitasData] = await Promise.all([
        liderIds.length > 0
          ? supabase.from("lideres").select("id, nome_completo").in("id", liderIds)
          : Promise.resolve({ data: [] }),
        campanhaIds.length > 0
          ? supabase.from("campaigns").select("id, nome, utm_campaign").in("id", campanhaIds)
          : Promise.resolve({ data: [] }),
        eventoIds.length > 0
          ? supabase.from("event_registrations").select("id, event_id, events:event_id(id, name)").in("id", eventoIds)
          : Promise.resolve({ data: [] }),
        captacaoIds.length > 0
          ? supabase.from("lead_funnels").select("id, nome").in("id", captacaoIds)
          : Promise.resolve({ data: [] }),
        visitaIds.length > 0
          ? supabase.from("office_visits").select("id, protocolo").in("id", visitaIds)
          : Promise.resolve({ data: [] }),
      ]);

      const lideresMap = new Map((lideresData.data || []).map((l: any) => [l.id, l]));
      const campanhasMap = new Map((campanhasData.data || []).map((c: any) => [c.id, c]));
      const eventosMap = new Map((eventosData.data || []).map((e: any) => [e.id, { id: e.id, name: (e.events as any)?.name }]));
      const captacaoMap = new Map((captacaoCampanhasData.data || []).map((c: any) => [c.id, c]));
      const visitasMap = new Map((visitasData.data || []).map((v: any) => [v.id, v]));

      return (data || []).map((contact: any) => {
        let sourceInfo = "Manual";
        let sourceName: string | null = null;
        const sourceType = contact.source_type || "manual";

        if (contact.source_type === "lider" && contact.source_id) {
          const lider = lideresMap.get(contact.source_id);
          sourceInfo = lider ? `Líder: ${lider.nome_completo}` : "Líder: Desconhecido";
          sourceName = lider?.nome_completo || null;
        } else if (contact.source_type === "campanha" && contact.source_id) {
          const campanha = campanhasMap.get(contact.source_id);
          sourceInfo = campanha ? `Campanha: ${campanha.nome}` : "Campanha: Desconhecida";
          sourceName = campanha?.nome || null;
        } else if (contact.source_type === "evento" && contact.source_id) {
          const evento = eventosMap.get(contact.source_id);
          sourceInfo = evento ? `Evento: ${evento.name}` : "Evento: Desconhecido";
          sourceName = evento?.name || null;
        } else if (contact.source_type === "captacao" && contact.source_id) {
          const campanha = captacaoMap.get(contact.source_id);
          sourceInfo = campanha ? `Captação: ${campanha.nome}` : "Captação: Desconhecida";
          sourceName = campanha?.nome || null;
        } else if (contact.source_type === "visita" && contact.source_id) {
          const visita = visitasMap.get(contact.source_id);
          sourceInfo = visita ? `Visita: ${visita.protocolo}` : "Visita ao Gabinete";
          sourceName = visita?.protocolo || null;
        } else if (contact.source_type === "webhook") {
          sourceInfo = "Webhook (GreatPages)";
          sourceName = "GreatPages";
        } else if (contact.source_type === "whatsapp") {
          sourceInfo = "WhatsApp";
          sourceName = null;
        }

        return {
          id: contact.id,
          name: contact.nome,
          phone: formatPhoneToBR(contact.telefone_norm),
          email: contact.email || "",
          region: contact.cidade?.nome || contact.localidade || "N/A",
          registrationDate: contact.created_at,
          source: sourceInfo,
          sourceName,
          sourceType,
          consentWhatsApp: true,
          consentEmail: !!contact.email,
          lastActivity: contact.updated_at,
          cidade_id: contact.cidade_id,
          telefone_norm: contact.telefone_norm,
          source_type: contact.source_type,
          source_id: contact.source_id,
          genero: contact.genero,
          data_nascimento: contact.data_nascimento,
          is_verified: contact.is_verified,
          verification_code: contact.verification_code,
          verification_sent_at: contact.verification_sent_at,
          verified_at: contact.verified_at,
          requiresVerification: contact.source_type === "lider" && contact.source_id,
          is_active: contact.is_active !== false,
          opted_out_at: contact.opted_out_at,
          opt_out_reason: contact.opt_out_reason,
          opt_out_channel: contact.opt_out_channel,
          is_promoted: false, // será atualizado após a query
        };
      });
    },
  });

  // Buscar contagens
  const { data: totalCount = 0 } = useQuery({
    queryKey: ["contacts-total-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("office_contacts").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalWithWhatsAppCount = 0 } = useQuery({
    queryKey: ["contacts-whatsapp-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true })
        .not("telefone_norm", "is", null);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: totalWithEmailCount = 0 } = useQuery({
    queryKey: ["contacts-email-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("office_contacts")
        .select("*", { count: "exact", head: true })
        .not("email", "is", null);
      if (error) throw error;
      return count || 0;
    },
  });

  // Demo mode: override data with fake contacts
  const effectiveContacts = isDemoMode ? DEMO_CONTACTS : contacts;
  const effectiveTotalCount = isDemoMode ? DEMO_CONTACTS_STATS.total : totalCount;
  const effectiveWhatsAppCount = isDemoMode ? DEMO_CONTACTS_STATS.withWhatsApp : totalWithWhatsAppCount;
  const effectiveEmailCount = isDemoMode ? DEMO_CONTACTS_STATS.withEmail : totalWithEmailCount;
  const effectivePromotedIds = isDemoMode
    ? DEMO_CONTACTS.filter((c) => c.is_promoted).map((c) => c.id)
    : promotedContactIds;
  const effectiveIsLoading = isDemoMode ? false : isLoading;

  const handleWhatsAppClick = (phone: string) => {
    const normalizedPhone = phone.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/55${normalizedPhone}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleEmailClick = (email: string) => {
    window.open(`mailto:${email}`, "_blank");
  };

  // Filtros
  const filteredContacts = useMemo(() => effectiveContacts.filter((contact) => {
    const searchDigits = searchTerm.replace(/\D/g, "");
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (searchDigits.length >= 3 && (contact.phone?.includes(searchDigits) || contact.telefone_norm?.includes(searchDigits)));
    const matchesRegion = selectedRegion === "all" || contact.region === selectedRegion;

    let matchesSource = true;
    if (sourceFilter !== "all") {
      const contactSourceType = contact.source_type || "manual";

      if (sourceFilter === "manual") {
        matchesSource = contactSourceType === "manual" || contact.source_type === null;
      } else if (sourceFilter === "evento") {
        if (selectedEventId) {
          matchesSource = specificEventContactIds.includes(contact.id);
        } else {
          matchesSource = contactSourceType === "evento" || eventParticipantIds.includes(contact.id);
        }
      } else {
        matchesSource = contactSourceType === sourceFilter;
      }

      if (sourceFilter === "lider" && selectedLeaderId) {
        matchesSource = contact.source_id === selectedLeaderId;
      }

      if (sourceFilter === "captacao" && selectedCampaignId) {
        matchesSource = contact.source_id === selectedCampaignId;
      }
    }

    // Verificar se contato foi promovido a líder
    const isPromoted = effectivePromotedIds.includes(contact.id);

    let matchesStatus = true;
    if (statusFilter === "active") {
      // Ativos: is_active=true E NÃO foi promovido
      matchesStatus = contact.is_active !== false && !isPromoted;
    } else if (statusFilter === "inactive") {
      // Inativos: is_active=false E NÃO foi promovido
      matchesStatus = contact.is_active === false && !isPromoted;
    } else if (statusFilter === "promoted") {
      // Promovidos: apenas contatos que foram promovidos a líder
      matchesStatus = isPromoted;
    } else if (statusFilter === "all") {
      // Todos: EXCETO os promovidos
      matchesStatus = !isPromoted;
    }

    return matchesSearch && matchesRegion && matchesSource && matchesStatus;
  }), [effectiveContacts, searchTerm, selectedRegion, sourceFilter, selectedEventId, specificEventContactIds, eventParticipantIds, selectedLeaderId, selectedCampaignId, effectivePromotedIds, statusFilter]);

  const pendingVerificationCount = useMemo(
    () => effectiveContacts.filter((c) => c.requiresVerification && !c.is_verified).length,
    [effectiveContacts]
  );

  const verificationFilteredContacts = useMemo(() => filteredContacts.filter((contact) => {
    if (verificationFilter === "all") return true;
    if (verificationFilter === "verified") return contact.is_verified === true;
    if (verificationFilter === "sms_not_sent")
      return contact.requiresVerification && !contact.is_verified && !contact.verification_sent_at;
    if (verificationFilter === "pending")
      return contact.requiresVerification && !contact.is_verified && contact.verification_sent_at;
    if (verificationFilter === "not_required") return !contact.requiresVerification;
    return true;
  }), [filteredContacts, verificationFilter]);

  const totalPages = useMemo(
    () => Math.ceil(verificationFilteredContacts.length / ITEMS_PER_PAGE),
    [verificationFilteredContacts.length]
  );
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return verificationFilteredContacts.slice(startIndex, endIndex);
  }, [verificationFilteredContacts, currentPage]);

  const { data: allRegions = [] } = useRegions();

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const regions = allRegions.map((r) => r.nome).sort();

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRegion("all");
    setSourceFilter("all");
    setSelectedLeaderId(null);
    setSelectedEventId(null);
    setSelectedCampaignId(null);
    setVerificationFilter("all");
    setStatusFilter("active");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchTerm ||
    selectedRegion !== "all" ||
    sourceFilter !== "all" ||
    verificationFilter !== "all" ||
    statusFilter !== "active";

  const inactiveCount = effectiveContacts.filter((c) => c.is_active === false && !effectivePromotedIds.includes(c.id)).length;
  const promotedCount = effectivePromotedIds.length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <TutorialOverlay page="contacts" />
      {/* Header Compacto */}
      <div className="mb-6">
        <div data-tutorial="contacts-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <PageHeader icon={Users} title="Base de Contatos" />
            <div data-tutorial="contacts-stats" className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <strong className="text-foreground">{m.number(effectiveTotalCount, 'contacts_total')}</strong> contatos
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-green-600" />
                <strong className="text-foreground">{m.number(effectiveWhatsAppCount, 'contacts_wa')}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-blue-600" />
                <strong className="text-foreground">{m.number(effectiveEmailCount, 'contacts_email')}</strong>
              </span>
              {pendingVerificationCount > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                  {pendingVerificationCount} pendentes
                </Badge>
              )}
              {promotedCount > 0 && (
                <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  {promotedCount} promovidos
                </Badge>
              )}
            </div>
          </div>
          <div data-tutorial="contacts-actions" className="flex flex-wrap gap-2">
            <TutorialButton onClick={restartTutorial} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => identifyGenders.mutate()}
              disabled={identifyGenders.isPending}
            >
              {identifyGenders.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="hidden sm:inline ml-2">Identificar Gêneros</span>
            </Button>
            <ImportContactsExcelDialog />
            <ImportEmailsDialog />
          </div>
        </div>
      </div>

      {/* Card de Verificação Pendente */}
      <div className="mb-6">
        <VerificationSummaryCard />
      </div>

      {/* Barra de Filtros */}
      <Card data-tutorial="contacts-filters" className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Busca */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  handleFilterChange();
                }}
                className="pl-9 h-9"
              />
            </div>

            {/* Região */}
            <Select
              value={selectedRegion}
              onValueChange={(value) => {
                setSelectedRegion(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[180px] h-9">
                <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as regiões</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Origem */}
            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                setSourceFilter(value);
                setSelectedLeaderId(null);
                setSelectedEventId(null);
                setSelectedCampaignId(null);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as origens</SelectItem>
                <SelectItem value="evento">Evento</SelectItem>
                <SelectItem value="lider">Link de Líder</SelectItem>
                <SelectItem value="manual">Importação</SelectItem>
                <SelectItem value="captacao">Captação</SelectItem>
                <SelectItem value="visita">Visita</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="pesquisa">Pesquisa</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro condicional: Líder */}
            {sourceFilter === "lider" && (
              <Select
                value={selectedLeaderId || "all"}
                onValueChange={(value) => {
                  setSelectedLeaderId(value === "all" ? null : value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Líder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os líderes</SelectItem>
                  {leadersForFilter.map((leader) => (
                    <SelectItem key={leader.id} value={leader.id}>
                      {m.name(leader.nome_completo)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtro condicional: Evento */}
            {sourceFilter === "evento" && (
              <Select
                value={selectedEventId || "all"}
                onValueChange={(value) => {
                  setSelectedEventId(value === "all" ? null : value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {eventsForFilter.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {m.name(event.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtro condicional: Funil */}
            {sourceFilter === "captacao" && (
              <Select
                value={selectedCampaignId || "all"}
                onValueChange={(value) => {
                  setSelectedCampaignId(value === "all" ? null : value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Funil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os funis</SelectItem>
                  {funnelsForFilter.map((funnel) => (
                    <SelectItem key={funnel.id} value={funnel.id}>
                      {funnel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Verificação */}
            <Select
              value={verificationFilter}
              onValueChange={(value) => {
                setVerificationFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Verificação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sms_not_sent">SMS Não Enviado</SelectItem>
                <SelectItem value="pending">Aguardando Verificação</SelectItem>
                <SelectItem value="verified">Verificados</SelectItem>
                <SelectItem value="not_required">Não Requer</SelectItem>
              </SelectContent>
            </Select>

            {/* Status */}
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos ({inactiveCount})</SelectItem>
                <SelectItem value="promoted">Promovido a Líder ({promotedCount})</SelectItem>
              </SelectContent>
            </Select>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info da Paginação */}
      <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Mostrando <strong className="text-foreground">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong>-
          <strong className="text-foreground">{Math.min(currentPage * ITEMS_PER_PAGE, verificationFilteredContacts.length)}</strong> de{" "}
          <strong className="text-foreground">{verificationFilteredContacts.length}</strong>
        </span>
        <span>
          Página {currentPage} de {totalPages || 1}
        </span>
      </div>

      {/* Lista de Contatos */}
      <div className="space-y-3">
        {effectiveIsLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Carregando contatos...</p>
            </CardContent>
          </Card>
        ) : paginatedContacts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum contato encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros ou adicionar novos contatos.</p>
            </CardContent>
          </Card>
        ) : (
          paginatedContacts.map((contact) => {
            const avatarColor = getAvatarColor(contact.name);
            const initials = contact.name
              .split(" ")
              .map((n: string) => n[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const sourceConf = sourceConfig[contact.sourceType] || sourceConfig.manual;
            const SourceIcon = sourceConf.icon;

            return (
              <Card key={contact.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Lado Esquerdo: Avatar + Info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Avatar */}
                      <div
                        className={`w-12 h-12 bg-gradient-to-br ${avatarColor.bg} ${avatarColor.text} rounded-xl flex items-center justify-center font-bold text-lg flex-shrink-0 shadow-sm`}
                      >
                        {initials}
                      </div>

                      {/* Informações */}
                      <div className="flex-1 min-w-0">
                        {/* Nome e Região */}
                        <h3 className="font-semibold text-foreground truncate">{m.name(contact.name)}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                          <span className="truncate">{m.city(contact.region)}</span>
                        </p>

                        {/* Badges */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {/* Badge de Origem */}
                          <Badge variant="outline" className={`text-xs ${sourceConf.className} border`}>
                            <SourceIcon className="h-3 w-3 mr-1" />
                            {sourceConf.label}
                          </Badge>

                          {/* Badge de Atribuição (nome do líder/evento/etc) */}
                          {contact.sourceName && (
                            <Badge variant="secondary" className="text-xs bg-muted/50">
                              {m.name(contact.sourceName)}
                            </Badge>
                          )}

                          {/* Badge de Verificação */}
                          {contact.requiresVerification &&
                            (contact.is_verified ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Verificado
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            ))}

                          {/* Badge de Status Inativo */}
                          {contact.is_active === false && !effectivePromotedIds.includes(contact.id) && (
                            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              <Ban className="h-3 w-3 mr-1" />
                              Inativo
                            </Badge>
                          )}

                          {/* Badge de Promovido a Líder */}
                          {effectivePromotedIds.includes(contact.id) && (
                            <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                              <Crown className="h-3 w-3 mr-1" />
                              Promovido a Líder
                            </Badge>
                          )}
                        </div>

                        {/* Contatos */}
                        <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            {m.phone(contact.phone)}
                          </span>
                          {contact.email && (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <span className="truncate max-w-[200px]">{m.email(contact.email)}</span>
                            </span>
                          )}
                        </div>

                        {/* Data de Cadastro */}
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Cadastrado em {format(new Date(contact.registrationDate), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    {/* Lado Direito: Ações */}
                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setEditingContact({
                            id: contact.id,
                            nome: contact.name,
                            telefone_norm: contact.telefone_norm,
                            cidade_id: contact.cidade_id,
                            source_type: contact.source_type,
                            source_id: contact.source_id,
                            genero: contact.genero,
                            data_nascimento: contact.data_nascimento,
                          })
                        }
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => handleWhatsAppClick(contact.phone)}
                      >
                        <Phone className="h-4 w-4" />
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setSelectedContact(contact)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 bg-gradient-to-br ${avatarColor.bg} ${avatarColor.text} rounded-lg flex items-center justify-center font-bold`}
                              >
                                {initials}
                              </div>
                              {m.name(contact.name)}
                            </DialogTitle>
                          </DialogHeader>
                          {selectedContact && <ContactDetails contact={selectedContact} />}
                        </DialogContent>
                      </Dialog>

                      {/* Botão Desativar/Reativar - Apenas Admin */}
                      {isAdmin &&
                        (contact.is_active !== false ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeactivatingContact({ id: contact.id, name: contact.name })}
                            title="Desativar contato"
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => reactivateContact.mutate({ contactId: contact.id, userId: user?.id })}
                            disabled={reactivateContact.isPending}
                            title="Reativar contato"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {currentPage > 3 && (
              <>
                <Button
                  variant={currentPage === 1 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  className="w-9 h-9 p-0"
                >
                  1
                </Button>
                {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
              </>
            )}

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (page) =>
                  page === currentPage ||
                  page === currentPage - 1 ||
                  page === currentPage + 1 ||
                  (currentPage <= 2 && page <= 3) ||
                  (currentPage >= totalPages - 1 && page >= totalPages - 2),
              )
              .map((page) => (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-9 h-9 p-0"
                >
                  {page}
                </Button>
              ))}

            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="px-2 text-muted-foreground">...</span>}
                <Button
                  variant={currentPage === totalPages ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-9 h-9 p-0"
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Dialog de Edição */}
      {editingContact && (
        <EditContactDialog
          contact={editingContact}
          open={!!editingContact}
          onOpenChange={(open) => !open && setEditingContact(null)}
        />
      )}

      {/* Dialog de Desativação */}
      <DeactivateContactDialog
        open={!!deactivatingContact}
        onOpenChange={(open) => !open && setDeactivatingContact(null)}
        contact={deactivatingContact}
      />
    </div>
  );
};

// Componente de detalhes do contato com Tabs
const ContactDetails = ({ contact }: { contact: any }) => {
  const { m } = useDemoMask();
  const locationConfig = useTenantLocationConfig();
  const { data: eventParticipation = [], isLoading: isLoadingEvents } = useContactEventParticipation(contact.id);
  const { data: pageViews = [], isLoading: isLoadingPageViews } = useContactPageViews(contact.id);
  const { data: downloads = [], isLoading: isLoadingDownloads } = useContactDownloads(contact.id);
  const { data: activityLog = [], isLoading: isLoadingActivityLog } = useContactActivityLog(contact.id);
  const { data: communications, isLoading: isLoadingCommunications } = useContactCommunications(
    contact.id,
    contact.telefone_norm,
    contact.email,
  );
  const { data: visits = [], isLoading: isLoadingVisits } = useContactVisits(contact.id);
  const { data: surveyParticipation = [], isLoading: isLoadingSurveys } = useContactSurveyParticipation(contact.id);

  const handleWhatsAppClick = (phone: string) => {
    const normalizedPhone = phone.replace(/\D/g, "");
    const whatsappUrl = `https://wa.me/55${normalizedPhone}`;
    window.open(whatsappUrl, "_blank");
  };

  const optOutChannelLabels: Record<string, string> = {
    email: "E-mail",
    whatsapp: "WhatsApp",
    admin: "Administrador",
  };

  const actionLabels: Record<string, { label: string; icon: any; color: string }> = {
    created: { label: "Contato Criado", icon: UserPlus, color: "text-blue-600 bg-blue-50" },
    edited: { label: "Contato Editado", icon: Edit, color: "text-purple-600 bg-purple-50" },
    promoted_to_leader: { label: "Promovido a Líder", icon: Crown, color: "text-amber-600 bg-amber-50" },
    deactivated: { label: "Desativado", icon: UserMinus, color: "text-red-600 bg-red-50" },
    reactivated: { label: "Reativado", icon: UserPlus, color: "text-green-600 bg-green-50" },
    verified: { label: "Verificado", icon: ShieldCheck, color: "text-green-600 bg-green-50" },
    verification_sent: { label: "Código de Verificação Enviado", icon: Send, color: "text-blue-600 bg-blue-50" },
    whatsapp_sent: { label: "WhatsApp Enviado", icon: MessageSquare, color: "text-green-600 bg-green-50" },
    email_sent: { label: "E-mail Enviado", icon: Mail, color: "text-blue-600 bg-blue-50" },
    event_registered: { label: "Inscrito em Evento", icon: Calendar, color: "text-purple-600 bg-purple-50" },
    event_checkin: { label: "Check-in em Evento", icon: CheckCheck, color: "text-green-600 bg-green-50" },
    visit_created: { label: "Visita Agendada", icon: Building2, color: "text-blue-600 bg-blue-50" },
    visit_checkin: { label: "Check-in de Visita", icon: CheckCheck, color: "text-green-600 bg-green-50" },
  };

  const whatsappStatusConfig: Record<string, { label: string; icon: any; color: string }> = {
    pending: { label: "Pendente", icon: Clock, color: "text-gray-500" },
    sent: { label: "Enviado", icon: Check, color: "text-gray-500" },
    delivered: { label: "Entregue", icon: CheckCheck, color: "text-green-600" },
    read: { label: "Lido", icon: CheckCheck, color: "text-blue-600" },
    failed: { label: "Erro", icon: AlertCircle, color: "text-red-600" },
  };

  const visitStatusLabels: Record<string, string> = {
    REGISTERED: "Registrada",
    LINK_SENT: "Link Enviado",
    FORM_OPENED: "Formulário Aberto",
    FORM_SUBMITTED: "Formulário Enviado",
    CHECKED_IN: "Check-in Realizado",
    CANCELLED: "Cancelada",
    MEETING_COMPLETED: "Reunião Concluída",
    RESCHEDULED: "Reagendada",
  };

  return (
    <Tabs defaultValue="info" className="mt-4">
      <TabsList className="grid w-full grid-cols-7">
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="eventos">Eventos</TabsTrigger>
        <TabsTrigger value="pesquisas">Pesquisas</TabsTrigger>
        <TabsTrigger value="atividade">Atividade</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
        <TabsTrigger value="verificacao">Verificação</TabsTrigger>
        <TabsTrigger value="status">Status</TabsTrigger>
      </TabsList>

      {/* Tab: Informações */}
      <TabsContent value="info" className="mt-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">{locationConfig.label}</label>
              <p className="font-medium flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {m.city(contact.region)}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Origem</label>
              <p className="text-sm">{m.observation(contact.source)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data de Cadastro</label>
              <p className="text-sm">
                {format(new Date(contact.registrationDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
            {contact.genero && contact.genero !== "Não identificado" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Gênero</label>
                <p className="text-sm">{contact.genero}</p>
              </div>
            )}
            {contact.data_nascimento && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Data de Nascimento</label>
                <p className="text-sm flex items-center gap-1.5">
                  <Cake className="h-4 w-4 text-muted-foreground" />
                  {format(new Date(contact.data_nascimento + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">WhatsApp</label>
              <div className="flex items-center justify-between">
                <p className="font-medium">{m.phone(contact.phone)}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:bg-green-50"
                  onClick={() => handleWhatsAppClick(contact.phone)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {contact.email && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                <div className="flex items-center justify-between">
                  <p className="font-medium truncate">{m.email(contact.email)}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 hover:bg-blue-50"
                    onClick={() => window.open(`mailto:${contact.email}`, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <div className="flex items-center gap-2 mt-1">
                {contact.is_active !== false ? (
                  <Badge className="bg-green-100 text-green-700 border-green-200">Ativo</Badge>
                ) : (
                  <Badge variant="destructive">Inativo (Descadastrado)</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Tab: Eventos */}
      <TabsContent value="eventos" className="mt-4">
        {isLoadingEvents ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eventParticipation.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma participação em eventos registrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventParticipation.map((event: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{m.name(event.event_name)}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {event.event_date
                          ? format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })
                          : "Data não informada"}
                      </span>
                      {event.event_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {event.event_time}
                        </span>
                      )}
                    </div>
                    {event.event_location && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {event.event_location}
                        {event.event_address && ` - ${event.event_address}`}
                      </p>
                    )}
                    {event.event_categories && event.event_categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {event.event_categories.map((cat, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      variant={event.checked_in ? "default" : "secondary"}
                      className={event.checked_in ? "bg-green-100 text-green-700" : ""}
                    >
                      {event.checked_in ? "✓ Check-in" : "Inscrito"}
                    </Badge>
                    {event.checked_in_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.checked_in_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Tab: Pesquisas */}
      <TabsContent value="pesquisas" className="mt-4">
        {isLoadingSurveys ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : surveyParticipation.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhuma participação em pesquisas registrada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {surveyParticipation.map((response: any) => (
              <div key={response.id} className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 text-violet-600" />
                      {response.survey?.titulo || "Pesquisa"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Respondido em {format(new Date(response.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className="bg-violet-100 text-violet-700 border-violet-200">✓ Respondido</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      {/* Tab: Atividade */}
      <TabsContent value="atividade" className="mt-4 space-y-6">
        {/* Comunicações WhatsApp */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-green-600" />
            WhatsApp ({communications?.whatsapp?.length || 0})
          </h4>
          {isLoadingCommunications ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !communications?.whatsapp?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem WhatsApp.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {communications.whatsapp.slice(0, 10).map((msg: any, idx: number) => {
                const statusConfig = whatsappStatusConfig[msg.status] || whatsappStatusConfig.pending;
                const StatusIcon = statusConfig.icon;
                return (
                  <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30 border">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs">{m.observation(msg.message.substring(0, 60))}...</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Comunicações SMS */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-purple-600" />
            SMS ({communications?.sms?.length || 0})
          </h4>
          {isLoadingCommunications ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !communications?.sms?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum SMS enviado.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {communications.sms.slice(0, 10).map((msg: any, idx: number) => {
                const statusConfig = whatsappStatusConfig[msg.status] || whatsappStatusConfig.pending;
                const StatusIcon = statusConfig.icon;
                return (
                  <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30 border">
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs">{m.observation(msg.message.substring(0, 60))}...</p>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.color}`} />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Comunicações E-mail */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-600" />
            E-mails ({communications?.email?.length || 0})
          </h4>
          {isLoadingCommunications ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !communications?.email?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum e-mail enviado.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {communications.email.slice(0, 10).map((email: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30 border">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-xs">{email.subject}</p>
                    {email.template_name && <p className="text-xs text-muted-foreground">{email.template_name}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge
                      variant="outline"
                      className={`text-xs ${email.status === "sent" ? "text-green-600" : email.status === "failed" ? "text-red-600" : "text-gray-500"}`}
                    >
                      {email.status === "sent" ? "Enviado" : email.status === "failed" ? "Erro" : "Pendente"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(email.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Visitas */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-purple-600" />
            Visitas ao Gabinete ({visits?.length || 0})
          </h4>
          {isLoadingVisits ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : !visits?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma visita registrada.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {visits.map((visit: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30 border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs">{visit.protocolo}</p>
                    {visit.leader_name && <p className="text-xs text-muted-foreground">Líder: {m.name(visit.leader_name)}</p>}
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <Badge variant="outline" className="text-xs">
                      {visitStatusLabels[visit.status] || visit.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(visit.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Páginas Acessadas */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Páginas Acessadas ({pageViews?.length || 0})
          </h4>
          {isLoadingPageViews ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : pageViews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma página acessada.</p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {pageViews.slice(0, 5).map((view: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                  <span>{view.page_name || view.page_identifier}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(view.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Downloads */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            Downloads de Materiais ({downloads?.length || 0})
          </h4>
          {isLoadingDownloads ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : downloads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum material baixado.</p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {downloads.map((download: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                  <span>{download.lead_magnet_nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(download.downloaded_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Tab: Histórico de Alterações */}
      <TabsContent value="historico" className="mt-4">
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Histórico de Atividades
          </h4>

          {isLoadingActivityLog ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activityLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Nenhuma atividade registrada.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activityLog.map((activity) => {
                const actionConfig = actionLabels[activity.action] || {
                  label: activity.action,
                  icon: History,
                  color: "text-gray-600 bg-gray-50",
                };
                const IconComponent = actionConfig.icon;

                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${actionConfig.color}`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{actionConfig.label}</p>
                      <p className="text-xs text-muted-foreground">
                        por {m.name(activity.user_name || "Sistema")} •{" "}
                        {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {activity.details?.reason && (
                        <p className="text-xs text-muted-foreground mt-1">Motivo: {activity.details.reason}</p>
                      )}
                      {activity.details?.leader_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Líder criado: {m.name(activity.details.leader_name)}
                        </p>
                      )}
                      {activity.details?.field && (
                        <p className="text-xs text-muted-foreground mt-1">Campo: {activity.details.field}</p>
                      )}
                      {activity.details?.event_name && (
                        <p className="text-xs text-muted-foreground mt-1">Evento: {m.name(activity.details.event_name)}</p>
                      )}
                      {activity.details?.template_name && (
                        <p className="text-xs text-muted-foreground mt-1">Template: {activity.details.template_name}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TabsContent>

      {/* Tab: Verificação */}
      <TabsContent value="verificacao" className="mt-4">
        {!contact.requiresVerification ? (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Este contato não requer verificação.</p>
            <p className="text-xs mt-1">Apenas contatos indicados por líderes precisam confirmar o cadastro.</p>
          </div>
        ) : contact.is_verified ? (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <ShieldCheck className="h-5 w-5" />
              Contato Verificado
            </div>
            <p className="text-sm text-green-600 mt-2">
              Este contato confirmou seu cadastro clicando no link enviado por SMS.
            </p>
            {contact.verified_at && (
              <p className="text-xs text-green-500 mt-2">
                Verificado em: {format(new Date(contact.verified_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-4">
            <div className="flex items-center gap-2 text-amber-700 font-medium">
              <ShieldAlert className="h-5 w-5" />
              Verificação Pendente
            </div>
            <p className="text-sm text-amber-600">
              Este contato foi indicado por um líder e precisa confirmar seu cadastro clicando no link enviado por SMS.
            </p>
            <div className="flex items-center justify-between text-xs text-amber-600">
              <div>
                {contact.verification_sent_at && (
                  <span>
                    Enviado em: {format(new Date(contact.verification_sent_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
              <div className="font-mono bg-amber-100 px-2 py-1 rounded">
                Código: {contact.verification_code || "N/A"}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await resendVerificationSMS(contact.id);
              }}
              className="text-amber-700 border-amber-300 hover:bg-amber-100"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reenviar SMS
            </Button>
          </div>
        )}
      </TabsContent>

      {/* Tab: Status */}
      <TabsContent value="status" className="mt-4 space-y-4">
        {contact.is_active !== false ? (
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 text-green-700 font-medium">
              <UserCheck className="h-5 w-5" />
              Contato Ativo
            </div>
            <p className="text-sm text-green-600 mt-2">
              Este contato está ativo e pode receber comunicações por e-mail e WhatsApp.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <Ban className="h-5 w-5" />
                Contato Inativo (Descadastrado)
              </div>
              <p className="text-sm text-red-600 mt-2">Este contato não receberá mais comunicações.</p>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Detalhes do Descadastro</h4>

              <div className="grid gap-3 text-sm">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Data</label>
                  <p>
                    {contact.opted_out_at
                      ? format(new Date(contact.opted_out_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : "N/A"}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Canal</label>
                  <p className="flex items-center gap-2">
                    {contact.opt_out_channel === "email" && <Mail className="h-4 w-4 text-blue-600" />}
                    {contact.opt_out_channel === "whatsapp" && <Phone className="h-4 w-4 text-green-600" />}
                    {contact.opt_out_channel === "admin" && <UserMinus className="h-4 w-4 text-red-600" />}
                    {contact.opt_out_channel === "email"
                      ? "E-mail"
                      : contact.opt_out_channel === "whatsapp"
                        ? "WhatsApp"
                        : contact.opt_out_channel === "admin"
                          ? "Administrador"
                          : "N/A"}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Motivo</label>
                  <p className="text-muted-foreground">{contact.opt_out_reason || "Não informado"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default Contacts;
