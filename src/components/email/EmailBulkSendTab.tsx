import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Users, Calendar, Target, UserCheck, AlertTriangle, ClipboardList, Layers, Play, Clock, ShieldAlert, Network } from "lucide-react";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useEvents } from "@/hooks/events/useEvents";
import { useRegionMaterials } from "@/hooks/useRegionMaterials";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getProductionUrl, getTenantBaseUrl, generateEventAffiliateUrl, generateAffiliateUrl, generateLeaderReferralUrl, generateSurveyAffiliateUrl, generateUnsubscribeUrl, generateVerificationUrl, generateLeaderVerificationUrl } from "@/lib/urlHelper";
import { toast } from "sonner";
import { useBulkSendSession } from "@/hooks/useBulkSendSession";
import { ResumeSessionAlert } from "@/components/bulk-send/ResumeSessionAlert";
import { useTenantId } from "@/hooks/useTenantId";
import { useTenantDomain } from "@/hooks/useTenantDomain";

type RecipientType = "all_contacts" | "event_contacts" | "funnel_contacts" | "leaders" | "single_contact" | "single_leader" | "unverified_leaders" | "unverified_contacts" | "coordinator_tree";

// Templates que precisam de evento destino
const EVENT_INVITE_TEMPLATES = ["evento-convite-participar", "lideranca-evento-convite"];
// Templates que precisam de funil destino
const FUNNEL_INVITE_TEMPLATES = ["captacao-convite-material"];
// Templates que precisam de pesquisa destino
const SURVEY_INVITE_TEMPLATES = ["pesquisa-convite", "lideranca-pesquisa-link"];
// Templates de links de afiliado (apenas para líderes, sem necessidade de destino)
const LEADER_AFFILIATE_LINK_TEMPLATES = ["lideranca-reuniao-link", "lideranca-cadastro-link"];
// Template de validação de cadastro
const VERIFICATION_TEMPLATE = "validacao-cadastro-email";
// Template de material de região
const REGION_MATERIAL_TEMPLATE = "material-regiao-email";

// Opções de tamanho de lote
const BATCH_SIZE_OPTIONS = [
  { value: "10", label: "10 por vez" },
  { value: "20", label: "20 por vez" },
  { value: "30", label: "30 por vez" },
  { value: "50", label: "50 por vez" },
  { value: "100", label: "100 por vez" },
  { value: "all", label: "Todos de uma vez" },
];

// Função para gerar código de verificação
function generateVerificationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array(6).fill(0).map(() => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

export function EmailBulkSendTab() {
  const { data: templates, isLoading: loadingTemplates } = useEmailTemplates();
  const { data: events } = useEvents();
  const { data: regionMaterials } = useRegionMaterials();
  const tenantId = useTenantId();
  const tenantDomain = useTenantDomain();

  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [recipientType, setRecipientType] = useState<RecipientType>("all_contacts");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedFunnel, setSelectedFunnel] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  // Estados para controle de lotes
  const [batchSize, setBatchSize] = useState("20");
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const continueResolve = useRef<(() => void) | null>(null);

  // Função para continuar envio após pausa
  const handleContinue = () => {
    if (continueResolve.current) {
      continueResolve.current();
      continueResolve.current = null;
    }
    setIsPaused(false);
  };

  // Estados para evento/funil/pesquisa DESTINO (para preencher variáveis)
  const [targetEventId, setTargetEventId] = useState("");
  const [targetFunnelId, setTargetFunnelId] = useState("");
  const [targetSurveyId, setTargetSurveyId] = useState("");

  // Estados para envio individual
  const [singleContactSearch, setSingleContactSearch] = useState("");
  const [selectedSingleContact, setSelectedSingleContact] = useState<{id: string; nome: string; email: string} | null>(null);
  const [selectedSingleLeader, setSelectedSingleLeader] = useState<{id: string; nome_completo: string; email: string; affiliate_token: string | null} | null>(null);

  // Estados para árvore de coordenador
  const [coordinatorSearch, setCoordinatorSearch] = useState("");
  const [selectedCoordinator, setSelectedCoordinator] = useState<{
    id: string;
    nome_completo: string;
    total_in_tree: number;
    unverified_count: number;
  } | null>(null);

  // Hook de sessão para retomada
  const {
    pendingSession,
    showResumeDialog,
    startSession,
    markSent,
    getSentIdentifiers,
    clearSession,
    dismissDialog,
    getPendingCount,
  } = useBulkSendSession("email");

  // Estado para controle de retomada
  const [isResuming, setIsResuming] = useState(false);

  // Detectar tipo do template selecionado
  const isEventInviteTemplate = EVENT_INVITE_TEMPLATES.includes(selectedTemplate);
  const isFunnelInviteTemplate = FUNNEL_INVITE_TEMPLATES.includes(selectedTemplate);
  const isSurveyInviteTemplate = SURVEY_INVITE_TEMPLATES.includes(selectedTemplate);
  const isLeaderAffiliateLinkTemplate = LEADER_AFFILIATE_LINK_TEMPLATES.includes(selectedTemplate);
  const isVerificationTemplate = selectedTemplate === VERIFICATION_TEMPLATE;
  const isRegionMaterialTemplate = selectedTemplate === REGION_MATERIAL_TEMPLATE;

  // Estado para material de região selecionado
  const [selectedMaterialId, setSelectedMaterialId] = useState("");

  // Fetch funnels
  const { data: funnels } = useQuery({
    queryKey: ["lead_funnels_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_funnels")
        .select("id, nome, slug, lead_magnet_nome, descricao")
        .eq("status", "active")
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Fetch target event details (para preencher variáveis)
  const { data: targetEvent } = useQuery({
    queryKey: ["target_event", targetEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, slug, date, time, location, address, description")
        .eq("id", targetEventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetEventId && isEventInviteTemplate,
  });

  // Fetch target funnel details (para preencher variáveis)
  const { data: targetFunnel } = useQuery({
    queryKey: ["target_funnel", targetFunnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_funnels")
        .select("id, nome, slug, lead_magnet_nome, descricao, subtitulo")
        .eq("id", targetFunnelId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetFunnelId && isFunnelInviteTemplate,
  });

  // Fetch surveys for selection
  const { data: surveys } = useQuery({
    queryKey: ["surveys-active-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("id, titulo, slug, descricao, status")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch target survey details (para preencher variáveis)
  const { data: targetSurvey } = useQuery({
    queryKey: ["target_survey_email", targetSurveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("id, titulo, slug, descricao")
        .eq("id", targetSurveyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetSurveyId && isSurveyInviteTemplate,
  });

  // Buscar nome do deputado/organização (para template de reunião e cabeçalho)
  const { data: organization } = useQuery({
    queryKey: ["organization-name-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization")
        .select("nome, cargo")
        .limit(1)
        .single();
      if (error) return { nome: "Deputado", cargo: "" };
      return data;
    },
  });

  // Buscar IDs de contatos promovidos (excluir do envio)
  const { data: promotedContactIds = [] } = useQuery({
    queryKey: ['promoted-contact-ids-email'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contact_activity_log')
        .select('contact_id')
        .eq('action', 'promoted_to_leader');
      return [...new Set((data || []).map(r => r.contact_id))];
    }
  });

  // Busca de contatos para envio individual
  const { data: contactSearchResults } = useQuery({
    queryKey: ["contact-search-email", singleContactSearch, promotedContactIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_contacts")
        .select("id, nome, email")
        .not("email", "is", null)
        .neq("email", "")
        .ilike("nome", `%${singleContactSearch}%`)
        .limit(20);
      if (error) throw error;
      // Filtrar contatos promovidos
      return (data || []).filter(c => !promotedContactIds.includes(c.id)).slice(0, 10);
    },
    enabled: recipientType === "single_contact" && singleContactSearch.length >= 2,
  });

  // Busca de líderes para envio individual
  const { data: leaderSearchResults } = useQuery({
    queryKey: ["leader-search-email", singleContactSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, email, affiliate_token")
        .eq("is_active", true)
        .not("email", "is", null)
        .neq("email", "")
        .ilike("nome_completo", `%${singleContactSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: recipientType === "single_leader" && singleContactSearch.length >= 2,
  });

  // Fetch contagem de líderes não verificados
  const { data: unverifiedLeadersCount = 0 } = useQuery({
    queryKey: ["unverified-leaders-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lideres")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_verified", false)
        .not("email", "is", null)
        .neq("email", "")
        .is("verification_sent_at", null);
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch contagem de contatos não verificados (indicados por líderes)
  const { data: unverifiedContactsCount = 0 } = useQuery({
    queryKey: ["unverified-contacts-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("office_contacts")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("source_type", "lider")
        .eq("is_verified", false)
        .not("email", "is", null)
        .neq("email", "")
        .is("verification_sent_at", null);
      if (error) throw error;
      return count || 0;
    },
  });

  // Busca de coordenadores com contagem de não verificados
  const { data: coordinatorSearchResults } = useQuery({
    queryKey: ["coordinator-search-email", coordinatorSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_coordinators_with_unverified_count', {
        search_term: coordinatorSearch
      });
      if (error) throw error;
      return data as { id: string; nome_completo: string; total_in_tree: number; unverified_count: number }[];
    },
    enabled: recipientType === "coordinator_tree" && coordinatorSearch.length >= 2,
  });

  // Fetch recipients based on type
  const { data: recipients, isLoading: loadingRecipients } = useQuery({
    queryKey: ["email_recipients", recipientType, selectedEvent, selectedFunnel, selectedSingleContact?.id, selectedSingleLeader?.id, promotedContactIds],
    queryFn: async () => {
      if (recipientType === "single_contact" && selectedSingleContact) {
        return [{ id: selectedSingleContact.id, name: selectedSingleContact.nome, email: selectedSingleContact.email, type: "contact" as const }];
      }

      if (recipientType === "single_leader" && selectedSingleLeader) {
        return [{ id: selectedSingleLeader.id, name: selectedSingleLeader.nome_completo, email: selectedSingleLeader.email, type: "leader" as const, affiliateToken: selectedSingleLeader.affiliate_token }];
      }

      if (recipientType === "all_contacts") {
        const allData: { id: string; nome: string; email: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("office_contacts")
            .select("id, nome, email")
            .not("email", "is", null)
            .neq("email", "")
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        const filteredData = allData.filter(c => !promotedContactIds.includes(c.id));
        return filteredData.map(c => ({ id: c.id, name: c.nome, email: c.email!, type: "contact" as const }));
      }

      if (recipientType === "event_contacts" && selectedEvent) {
        const allData: { id: string; nome: string; email: string; contact_id: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("event_registrations")
            .select("id, nome, email, contact_id")
            .eq("event_id", selectedEvent)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        return allData.map(r => ({
          id: r.contact_id || r.id,
          name: r.nome,
          email: r.email,
          type: "contact" as const
        }));
      }

      if (recipientType === "funnel_contacts" && selectedFunnel) {
        const allData: { id: string; nome: string; email: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("office_contacts")
            .select("id, nome, email")
            .eq("source_type", "captacao")
            .eq("source_id", selectedFunnel)
            .not("email", "is", null)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        const filteredData = allData.filter(c => !promotedContactIds.includes(c.id));
        return filteredData.map(c => ({ id: c.id, name: c.nome, email: c.email!, type: "contact" as const }));
      }

      if (recipientType === "leaders") {
        const allData: { id: string; nome_completo: string; email: string | null; affiliate_token: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("lideres")
            .select("id, nome_completo, email, affiliate_token")
            .eq("is_active", true)
            .not("email", "is", null)
            .neq("email", "")
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        return allData.map(l => ({ id: l.id, name: l.nome_completo, email: l.email!, type: "leader" as const, affiliateToken: l.affiliate_token }));
      }

      // Líderes não verificados
      if (recipientType === "unverified_leaders") {
        const allData: { id: string; nome_completo: string; email: string | null; verification_code: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("lideres")
            .select("id, nome_completo, email, verification_code")
            .eq("is_active", true)
            .eq("is_verified", false)
            .not("email", "is", null)
            .neq("email", "")
            .is("verification_sent_at", null)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        return allData.map(l => ({
          id: l.id,
          name: l.nome_completo,
          email: l.email!,
          type: "leader" as const,
          verificationCode: l.verification_code
        }));
      }

      // Contatos não verificados (indicados por líderes)
      if (recipientType === "unverified_contacts") {
        const allData: { id: string; nome: string; email: string | null; verification_code: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase
            .from("office_contacts")
            .select("id, nome, email, verification_code")
            .eq("is_active", true)
            .eq("source_type", "lider")
            .eq("is_verified", false)
            .not("email", "is", null)
            .neq("email", "")
            .is("verification_sent_at", null)
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...data); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        return allData.map(c => ({
          id: c.id,
          name: c.nome,
          email: c.email!,
          type: "contact" as const,
          verificationCode: c.verification_code
        }));
      }

      // Líderes não verificados de uma árvore de coordenador
      if (recipientType === "coordinator_tree" && selectedCoordinator) {
        const allData: { id: string; nome_completo: string; email: string; verification_code: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await supabase.rpc('get_unverified_leaders_in_tree', {
            coordinator_id: selectedCoordinator.id
          }).range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) { allData.push(...(data as typeof allData)); hasMore = data.length === pageSize; page++; } else { hasMore = false; }
        }
        return allData.map(l => ({
          id: l.id,
          name: l.nome_completo,
          email: l.email!,
          type: "leader" as const,
          verificationCode: l.verification_code
        }));
      }

      return [];
    },
    enabled: recipientType === "all_contacts" ||
             recipientType === "leaders" ||
             recipientType === "unverified_leaders" ||
             recipientType === "unverified_contacts" ||
             (recipientType === "single_contact" && !!selectedSingleContact) ||
             (recipientType === "single_leader" && !!selectedSingleLeader) ||
             (recipientType === "event_contacts" && !!selectedEvent) ||
             (recipientType === "funnel_contacts" && !!selectedFunnel) ||
             (recipientType === "coordinator_tree" && !!selectedCoordinator),
  });

  // Templates de convite permitidos por tipo de destinatário
  const CONVITE_TEMPLATES_LEADERS = [
    "lideranca-evento-convite",
    "captacao-convite-material",
    "evento-convite-participar",
    "pesquisa-convite",
    "lideranca-pesquisa-link",
    "lideranca-reuniao-link",
    "lideranca-cadastro-link",
    "validacao-cadastro-email",
    "material-regiao-email",
  ];

  const CONVITE_TEMPLATES_CONTACTS = [
    "captacao-convite-material",
    "evento-convite-participar",
    "pesquisa-convite",
    "material-regiao-email",
  ];

  // Filter templates based on recipient type
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];

    // Para tipos de validação, só mostrar o template de validação
    if (recipientType === "unverified_leaders" || recipientType === "unverified_contacts" || recipientType === "coordinator_tree") {
      return templates.filter(t => t.slug === VERIFICATION_TEMPLATE);
    }

    if (recipientType === "leaders" || recipientType === "single_leader") {
      return templates.filter(t => CONVITE_TEMPLATES_LEADERS.includes(t.slug));
    }

    return templates.filter(t => CONVITE_TEMPLATES_CONTACTS.includes(t.slug));
  }, [templates, recipientType]);

  const canSend =
    selectedTemplate &&
    recipients &&
    recipients.length > 0 &&
    confirmed &&
    !isSending &&
    (!isEventInviteTemplate || targetEventId) &&
    (!isFunnelInviteTemplate || targetFunnelId) &&
    (!isSurveyInviteTemplate || targetSurveyId) &&
    (!isRegionMaterialTemplate || selectedMaterialId);

  // Calcular tempo estimado em minutos (média de 0.3 segundos por email)
  const estimatedMinutes = Math.ceil((recipients?.length || 0) * 0.3 / 60);

  const handleSend = async (resumeMode = false) => {
    if (!selectedTemplate || !recipients?.length) return;

    // Obter o template selecionado para o nome
    const templateData = templates?.find(t => t.slug === selectedTemplate);
    const templateName = templateData?.nome || selectedTemplate;

    setIsSending(true);
    setIsPaused(false);
    setCurrentBatch(0);
    let successCount = 0;
    let errorCount = 0;

    // SEMPRE usa URL de produção para comunicações externas (com domínio customizado do tenant)
    const baseUrl = getTenantBaseUrl(tenantDomain);
    const orgInfo = { politico: organization?.nome || "", cargo: organization?.cargo || "" };

    // Obter identificadores já enviados (para retomada)
    const sentIdentifiers = resumeMode || isResuming ? getSentIdentifiers() : new Set<string>();

    // Preparar lista de destinatários com variáveis
    const allRecipientsList = await Promise.all(recipients.map(async (r) => {
      const variables: Record<string, string> = {
        nome: r.name,
        politico: organization?.nome || "",
        cargo: organization?.cargo || "",
      };

      // Para templates de verificação, gerar código se necessário e link de verificação
      let verificationCode = (r as { verificationCode?: string | null }).verificationCode;

      if (isVerificationTemplate) {
        // Determinar se é líder ou contato
        const isLeader = r.type === "leader";

        // Gerar código se não existir
        if (!verificationCode) {
          verificationCode = generateVerificationCode();

          // Salvar código no banco
          if (isLeader) {
            await supabase
              .from("lideres")
              .update({ verification_code: verificationCode })
              .eq("id", r.id);
          } else {
            await supabase
              .from("office_contacts")
              .update({ verification_code: verificationCode })
              .eq("id", r.id);
          }
        }

        // Gerar link de verificação baseado no tipo
        const linkVerificacao = isLeader
          ? `${baseUrl}/verificar-lider/${verificationCode}`
          : generateVerificationUrl(verificationCode, tenantDomain);

        variables.link_verificacao = linkVerificacao;
        variables.deputado_nome = organization?.nome || "Deputado";
        variables.lider_nome = r.name; // Adiciona lider_nome que o template pode usar
      }

      if (isEventInviteTemplate && targetEvent) {
        variables.evento_nome = targetEvent.name;
        variables.evento_data = format(new Date(targetEvent.date), "dd 'de' MMMM", { locale: ptBR });
        variables.evento_hora = targetEvent.time;
        variables.evento_local = targetEvent.location;
        variables.evento_endereco = targetEvent.address || "";
        variables.evento_descricao = targetEvent.description || "";
        variables.link_inscricao = `${baseUrl}/eventos/${targetEvent.slug}`;

        const affiliateToken = (r as { affiliateToken?: string | null }).affiliateToken;
        if ((recipientType === "leaders" || recipientType === "single_leader") && affiliateToken) {
          variables.link_afiliado = generateEventAffiliateUrl(targetEvent.slug, affiliateToken, tenantDomain);
        }
      }

      if (isFunnelInviteTemplate && targetFunnel) {
        variables.material_nome = targetFunnel.lead_magnet_nome;
        variables.material_descricao = targetFunnel.subtitulo || "";
        variables.link_captacao = `${baseUrl}/captacao/${targetFunnel.slug}`;
      }

      if (isSurveyInviteTemplate && targetSurvey) {
        variables.pesquisa_titulo = targetSurvey.titulo;
        variables.link_pesquisa = `${baseUrl}/pesquisa/${targetSurvey.slug}`;

        const affiliateToken = (r as { affiliateToken?: string | null }).affiliateToken;
        if ((recipientType === "leaders" || recipientType === "single_leader") && affiliateToken && selectedTemplate === "lideranca-pesquisa-link") {
          const linkPesquisaAfiliado = generateSurveyAffiliateUrl(targetSurvey.slug, affiliateToken, tenantDomain);
          variables.link_pesquisa_afiliado = linkPesquisaAfiliado;
          variables.qr_code_url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkPesquisaAfiliado)}`;
        }
      }

      if (isRegionMaterialTemplate && selectedMaterialId) {
        const material = regionMaterials?.find(m => m.id === selectedMaterialId);
        if (material) {
          variables.material_nome = material.material_name;
          variables.link_material = material.material_url;
        }
      }

      if (isLeaderAffiliateLinkTemplate && (recipientType === "leaders" || recipientType === "single_leader")) {
        const affiliateToken = (r as { affiliateToken?: string | null }).affiliateToken;

        if (affiliateToken && selectedTemplate === "lideranca-reuniao-link") {
          const linkReuniaoAfiliado = generateAffiliateUrl(affiliateToken, tenantDomain);
          variables.deputado_nome = organization?.nome || "Deputado";
          variables.link_reuniao_afiliado = linkReuniaoAfiliado;
          variables.qr_code_url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkReuniaoAfiliado)}`;
        }

        if (affiliateToken && selectedTemplate === "lideranca-cadastro-link") {
          const linkCadastroAfiliado = generateLeaderReferralUrl(affiliateToken, tenantDomain, orgInfo);
          variables.link_cadastro_afiliado = linkCadastroAfiliado;
          variables.qr_code_url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(linkCadastroAfiliado)}`;
        }
      }

      return {
        to: r.email,
        toName: r.name,
        contactId: r.type === "contact" ? r.id : undefined,
        leaderId: r.type === "leader" ? r.id : undefined,
        eventId: isEventInviteTemplate ? targetEventId : (selectedEvent || undefined),
        variables,
        recipientId: r.id,
        recipientType: r.type,
      };
    }));

    // Filtrar recipients que ainda não receberam
    const recipientsList = allRecipientsList.filter(r => !sentIdentifiers.has(r.to));

    if (recipientsList.length === 0) {
      toast.info("Todos os destinatários já receberam o email");
      clearSession();
      setIsSending(false);
      return;
    }

    // Iniciar nova sessão se não estiver retomando
    if (!resumeMode && !isResuming) {
      startSession(
        selectedTemplate,
        selectedTemplate,
        templateName,
        recipientType,
        allRecipientsList.length,
        batchSize,
        targetEventId || undefined,
        targetFunnelId || undefined,
        targetSurveyId || undefined
      );
    }

    try {
      const totalRecipients = recipientsList.length;
      const batchSizeNum = batchSize === "all" ? totalRecipients : parseInt(batchSize);
      const numBatches = Math.ceil(totalRecipients / batchSizeNum);
      setTotalBatches(numBatches);
      setSendProgress({ current: 0, total: totalRecipients });

      for (let batch = 0; batch < numBatches; batch++) {
        setCurrentBatch(batch + 1);
        const start = batch * batchSizeNum;
        const end = Math.min(start + batchSizeNum, totalRecipients);
        const batchRecipients = recipientsList.slice(start, end);

        for (let i = 0; i < batchRecipients.length; i++) {
          const globalIndex = start + i;
          const recipient = batchRecipients[i];

          try {
            const { data, error } = await supabase.functions.invoke("send-email", {
              body: {
                templateSlug: selectedTemplate,
                tenantId: tenantId || undefined,
                ...recipient,
              },
            });

            if (error || !data?.success) {
              errorCount++;
            } else {
              successCount++;
              // Marcar como enviado para persistência
              markSent(recipient.to);

              // Atualizar verification_sent_at para templates de validação
              if (isVerificationTemplate) {
                if (recipient.recipientType === "leader") {
                  await supabase
                    .from("lideres")
                    .update({ verification_sent_at: new Date().toISOString() })
                    .eq("id", recipient.recipientId);
                } else {
                  await supabase
                    .from("office_contacts")
                    .update({ verification_sent_at: new Date().toISOString() })
                    .eq("id", recipient.recipientId);
                }
              }
            }
          } catch (err) {
            errorCount++;
          }

          setSendProgress({ current: globalIndex + 1, total: totalRecipients });

          // Pequeno delay entre emails (200ms)
          if (i < batchRecipients.length - 1 || batch < numBatches - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Pausar entre lotes (exceto no último)
        if (batch < numBatches - 1) {
          setIsPaused(true);
          await new Promise<void>((resolve) => {
            continueResolve.current = resolve;
          });
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} emails enviados com sucesso!`);
        // Limpar sessão quando concluir com sucesso
        clearSession();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} emails falharam`);
      }
    } catch (error) {
      console.error("Erro no envio em massa:", error);
      toast.error("Erro ao processar envio em massa");
    } finally {
      setIsSending(false);
      setIsPaused(false);
      setCurrentBatch(0);
      setTotalBatches(0);
      setSendProgress({ current: 0, total: 0 });
      setConfirmed(false);
      setIsResuming(false);
    }
  };

  // Handlers para retomada
  const handleResumeSession = () => {
    if (pendingSession) {
      setSelectedTemplate(pendingSession.templateSlug);
      setBatchSize(pendingSession.batchSize);
      setTargetEventId(pendingSession.targetEventId || "");
      setTargetFunnelId(pendingSession.targetFunnelId || "");
      setTargetSurveyId(pendingSession.targetSurveyId || "");
      setRecipientType(pendingSession.recipientType as RecipientType);
      setIsResuming(true);
      dismissDialog();
    }
  };

  const handleDiscardSession = () => {
    clearSession();
    setIsResuming(false);
  };

  return (
    <div className="space-y-6">
      {/* Alert de sessão pendente */}
      {pendingSession && showResumeDialog && (
        <ResumeSessionAlert
          session={pendingSession}
          onResume={handleResumeSession}
          onDiscard={handleDiscardSession}
          onDismiss={dismissDialog}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configuração do Envio</CardTitle>
            <CardDescription>
              Selecione o template e os destinatários
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tamanho do Lote */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Tamanho do Lote
              </Label>
              <Select value={batchSize} onValueChange={setBatchSize} disabled={isSending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BATCH_SIZE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O envio será pausado a cada {batchSize === "all" ? "término" : batchSize} emails para revisão
              </p>
            </div>

            {/* Recipient Type */}
            <div className="space-y-3">
              <Label>Tipo de Destinatários</Label>
              <RadioGroup
                value={recipientType}
                onValueChange={(v) => {
                  setRecipientType(v as RecipientType);
                  setSelectedEvent("");
                  setSelectedFunnel("");
                  setTargetEventId("");
                  setTargetFunnelId("");
                  setTargetSurveyId("");
                  setConfirmed(false);
                  setSelectedSingleContact(null);
                  setSelectedSingleLeader(null);
                  setSingleContactSearch("");
                  setCoordinatorSearch("");
                  setSelectedCoordinator(null);

                  // Auto-selecionar template de validação para tipos de validação
                  if (v === "unverified_leaders" || v === "unverified_contacts" || v === "coordinator_tree") {
                    setSelectedTemplate(VERIFICATION_TEMPLATE);
                  } else {
                    setSelectedTemplate("");
                  }
                }}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single_contact" id="single_contact" />
                  <Label htmlFor="single_contact" className="flex items-center gap-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    Contato Único
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single_leader" id="single_leader" />
                  <Label htmlFor="single_leader" className="flex items-center gap-2 cursor-pointer">
                    <UserCheck className="h-4 w-4" />
                    Líder Único
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all_contacts" id="all_contacts" />
                  <Label htmlFor="all_contacts" className="flex items-center gap-2 cursor-pointer">
                    <Users className="h-4 w-4" />
                    Todos os Contatos (com email)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="event_contacts" id="event_contacts" />
                  <Label htmlFor="event_contacts" className="flex items-center gap-2 cursor-pointer">
                    <Calendar className="h-4 w-4" />
                    Contatos de Evento Específico
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="funnel_contacts" id="funnel_contacts" />
                  <Label htmlFor="funnel_contacts" className="flex items-center gap-2 cursor-pointer">
                    <Target className="h-4 w-4" />
                    Contatos de Funil de Captação
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="leaders" id="leaders" />
                  <Label htmlFor="leaders" className="flex items-center gap-2 cursor-pointer">
                    <UserCheck className="h-4 w-4" />
                    Todas as Lideranças
                  </Label>
                </div>

                {/* Separador visual */}
                <div className="border-t my-2 pt-2">
                  <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mb-2">
                    <ShieldAlert className="h-3 w-3" />
                    Validação de Cadastro
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unverified_leaders" id="unverified_leaders" />
                  <Label htmlFor="unverified_leaders" className="flex items-center gap-2 cursor-pointer">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Líderes sem Validação
                    {unverifiedLeadersCount > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                        {unverifiedLeadersCount}
                      </Badge>
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unverified_contacts" id="unverified_contacts" />
                  <Label htmlFor="unverified_contacts" className="flex items-center gap-2 cursor-pointer">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Contatos sem Validação
                    {unverifiedContactsCount > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs">
                        {unverifiedContactsCount}
                      </Badge>
                    )}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="coordinator_tree" id="coordinator_tree" />
                  <Label htmlFor="coordinator_tree" className="flex items-center gap-2 cursor-pointer">
                    <Network className="h-4 w-4 text-purple-500" />
                    Árvore de Coordenador
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Busca de Coordenador para Árvore */}
            {recipientType === "coordinator_tree" && (
              <div className="space-y-2">
                <Label>Buscar Coordenador</Label>
                <Input
                  placeholder="Digite o nome do coordenador..."
                  value={coordinatorSearch}
                  onChange={(e) => {
                    setCoordinatorSearch(e.target.value);
                    setSelectedCoordinator(null);
                  }}
                />
                {coordinatorSearchResults && coordinatorSearchResults.length > 0 && !selectedCoordinator && (
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {coordinatorSearchResults.map((coordinator) => (
                      <button
                        key={coordinator.id}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                        onClick={() => {
                          setSelectedCoordinator(coordinator);
                          setCoordinatorSearch(coordinator.nome_completo);
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <p className="font-medium">{coordinator.nome_completo}</p>
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            {coordinator.unverified_count} não verificados
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {coordinator.total_in_tree} líderes na árvore
                        </p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedCoordinator && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{selectedCoordinator.nome_completo}</p>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                        {selectedCoordinator.unverified_count} não verificados
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedCoordinator.total_in_tree} líderes na árvore
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Busca de Contato Único */}
            {recipientType === "single_contact" && (
              <div className="space-y-2">
                <Label>Buscar Contato</Label>
                <Input
                  placeholder="Digite o nome do contato..."
                  value={singleContactSearch}
                  onChange={(e) => {
                    setSingleContactSearch(e.target.value);
                    setSelectedSingleContact(null);
                  }}
                />
                {contactSearchResults && contactSearchResults.length > 0 && !selectedSingleContact && (
                  <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                    {contactSearchResults.map((contact) => (
                      <button
                        key={contact.id}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                        onClick={() => {
                          setSelectedSingleContact(contact);
                          setSingleContactSearch(contact.nome);
                        }}
                      >
                        <p className="font-medium">{contact.nome}</p>
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedSingleContact && (
                  <div className="p-2 bg-muted rounded-md text-sm">
                    <p className="font-medium">{selectedSingleContact.nome}</p>
                    <p className="text-muted-foreground">{selectedSingleContact.email}</p>
                  </div>
                )}
              </div>
            )}

            {/* Busca de Líder Único */}
            {recipientType === "single_leader" && (
              <div className="space-y-2">
                <Label>Buscar Líder</Label>
                <Input
                  placeholder="Digite o nome do líder..."
                  value={singleContactSearch}
                  onChange={(e) => {
                    setSingleContactSearch(e.target.value);
                    setSelectedSingleLeader(null);
                  }}
                />
                {leaderSearchResults && leaderSearchResults.length > 0 && !selectedSingleLeader && (
                  <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                    {leaderSearchResults.map((leader) => (
                      <button
                        key={leader.id}
                        className="w-full px-3 py-2 text-left hover:bg-muted text-sm"
                        onClick={() => {
                          setSelectedSingleLeader(leader);
                          setSingleContactSearch(leader.nome_completo);
                        }}
                      >
                        <p className="font-medium">{leader.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">{leader.email}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedSingleLeader && (
                  <div className="p-2 bg-muted rounded-md text-sm">
                    <p className="font-medium">{selectedSingleLeader.nome_completo}</p>
                    <p className="text-muted-foreground">{selectedSingleLeader.email}</p>
                  </div>
                )}
              </div>
            )}

            {/* Event Selection (ORIGEM - de onde vêm os contatos) */}
            {recipientType === "event_contacts" && (
              <div className="space-y-2">
                <Label>Selecione o Evento (origem dos contatos)</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um evento" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Funnel Selection (ORIGEM - de onde vêm os contatos) */}
            {recipientType === "funnel_contacts" && (
              <div className="space-y-2">
                <Label>Selecione o Funil (origem dos contatos)</Label>
                <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um funil" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels?.map((funnel) => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        {funnel.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Template de Email</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(v) => {
                  setSelectedTemplate(v);
                  setTargetEventId("");
                  setTargetFunnelId("");
                  setTargetSurveyId("");
                  setSelectedMaterialId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um template" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplates.map((template) => (
                    <SelectItem key={template.slug} value={template.slug}>
                      {template.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* DESTINO: Seleção do Evento para convite */}
            {isEventInviteTemplate && (
              <div className="space-y-2 p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                <Label className="text-primary font-medium">
                  Para qual evento deseja convidar?
                </Label>
                <Select value={targetEventId} onValueChange={setTargetEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o evento do convite" />
                  </SelectTrigger>
                  <SelectContent>
                    {events?.filter(e => e.status === "active").map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetEvent && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>📅 {format(new Date(targetEvent.date), "dd/MM/yyyy")} às {targetEvent.time}</p>
                    <p>📍 {targetEvent.location}</p>
                  </div>
                )}
              </div>
            )}

            {/* DESTINO: Seleção do Funil/Material para convite */}
            {isFunnelInviteTemplate && (
              <div className="space-y-2 p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                <Label className="text-primary font-medium">
                  Para qual material deseja convidar?
                </Label>
                <Select value={targetFunnelId} onValueChange={setTargetFunnelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material do convite" />
                  </SelectTrigger>
                  <SelectContent>
                    {funnels?.map((funnel) => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        {funnel.lead_magnet_nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetFunnel && (
                  <div className="text-xs text-muted-foreground mt-2">
                    <p>📄 {targetFunnel.descricao || "Material de captação"}</p>
                  </div>
                )}
              </div>
            )}

            {/* DESTINO: Seleção da Pesquisa para convite */}
            {isSurveyInviteTemplate && (
              <div className="space-y-2 p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                <Label className="text-primary font-medium flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Para qual pesquisa deseja convidar?
                </Label>
                <Select value={targetSurveyId} onValueChange={setTargetSurveyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a pesquisa" />
                  </SelectTrigger>
                  <SelectContent>
                    {surveys?.map((survey) => (
                      <SelectItem key={survey.id} value={survey.id}>
                        {survey.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetSurvey && (
                  <div className="text-xs text-muted-foreground mt-2">
                    <p>📊 {targetSurvey.descricao || "Pesquisa eleitoral"}</p>
                  </div>
                )}
              </div>
            )}

            {/* DESTINO: Seleção do Material de Região */}
            {isRegionMaterialTemplate && (
              <div className="space-y-2 p-3 rounded-lg border-2 border-primary/20 bg-primary/5">
                <Label className="text-primary font-medium">
                  Qual material de região deseja enviar?
                </Label>
                <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionMaterials?.filter(m => m.is_active).map((material) => (
                      <SelectItem key={material.id} value={material.id}>
                        {material.material_name} - {material.office_cities?.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedMaterialId && regionMaterials?.find(m => m.id === selectedMaterialId) && (
                  <div className="text-xs text-muted-foreground mt-2">
                    <p>📄 {regionMaterials.find(m => m.id === selectedMaterialId)?.office_cities?.nome}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview & Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo do Envio</CardTitle>
            <CardDescription>
              Revise antes de enviar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingRecipients ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-muted-foreground">Destinatários</span>
                  <Badge variant="secondary" className="text-lg px-3">
                    {recipients?.length || 0}
                  </Badge>
                </div>

                {selectedTemplate && (
                  <div className="py-3 border-b">
                    <span className="text-muted-foreground">Template</span>
                    <p className="font-medium mt-1">
                      {filteredTemplates.find(t => t.slug === selectedTemplate)?.nome}
                    </p>
                  </div>
                )}

                {isEventInviteTemplate && targetEvent && (
                  <div className="py-3 border-b">
                    <span className="text-muted-foreground">Evento do Convite</span>
                    <p className="font-medium mt-1">{targetEvent.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(targetEvent.date), "dd/MM/yyyy")} às {targetEvent.time}
                    </p>
                  </div>
                )}

                {isFunnelInviteTemplate && targetFunnel && (
                  <div className="py-3 border-b">
                    <span className="text-muted-foreground">Material do Convite</span>
                    <p className="font-medium mt-1">{targetFunnel.lead_magnet_nome}</p>
                  </div>
                )}

                {isSurveyInviteTemplate && targetSurvey && (
                  <div className="py-3 border-b">
                    <span className="text-muted-foreground">Pesquisa do Convite</span>
                    <p className="font-medium mt-1">📊 {targetSurvey.titulo}</p>
                  </div>
                )}

                {isRegionMaterialTemplate && selectedMaterialId && (() => {
                  const mat = regionMaterials?.find(m => m.id === selectedMaterialId);
                  return mat ? (
                    <div className="py-3 border-b">
                      <span className="text-muted-foreground">Material de Região</span>
                      <p className="font-medium mt-1">📄 {mat.material_name}</p>
                      <p className="text-sm text-muted-foreground">{mat.office_cities?.nome}</p>
                    </div>
                  ) : null;
                })()}

                {isVerificationTemplate && (recipientType === "unverified_leaders" || recipientType === "unverified_contacts") && (
                  <div className="py-3 border-b">
                    <span className="text-muted-foreground">Tipo de Envio</span>
                    <p className="font-medium mt-1 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      {recipientType === "unverified_leaders" ? "Validação de Líderes" : "Validação de Contatos"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Será gerado um código de verificação único para cada destinatário
                    </p>
                  </div>
                )}

                {recipients && recipients.length > 0 && (
                  <div className="py-3">
                    <span className="text-muted-foreground text-sm">Primeiros destinatários:</span>
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {recipients.slice(0, 5).map((r) => (
                        <div key={r.id} className="text-sm flex justify-between">
                          <span className="truncate">{r.name}</span>
                          <span className="text-muted-foreground truncate ml-2">{r.email}</span>
                        </div>
                      ))}
                      {recipients.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ... e mais {recipients.length - 5} destinatários
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {recipients && recipients.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Você está prestes a enviar {recipients.length} emails. Esta ação não pode ser desfeita.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center space-x-2 pt-4">
                  <Checkbox
                    id="confirm"
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                  />
                  <Label htmlFor="confirm" className="text-sm cursor-pointer">
                    Confirmo que desejo enviar estes emails
                  </Label>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canSend}
                  onClick={() => handleSend(true)}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isResuming && pendingSession
                    ? `Retomar envio (${getPendingCount()} pendentes)`
                    : `Enviar ${recipients?.length || 0} Emails`
                  }
                </Button>

                {/* Progress bar during sending */}
                {isSending && sendProgress.total > 0 && (
                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {isPaused ? (
                          <Badge variant="outline" className="bg-amber-50 border-amber-300 text-amber-700">
                            Pausado
                          </Badge>
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        Lote {currentBatch} de {totalBatches}
                      </span>
                      <span className="font-medium">
                        {sendProgress.current} de {sendProgress.total} emails
                      </span>
                    </div>
                    <Progress
                      value={(sendProgress.current / sendProgress.total) * 100}
                      className="h-2"
                    />

                    {isPaused && (
                      <Alert className="bg-amber-50 border-amber-200">
                        <AlertDescription className="flex items-center justify-between">
                          <span className="text-amber-800">
                            ✅ Lote {currentBatch} concluído! Pronto para enviar lote {currentBatch + 1}?
                          </span>
                          <Button size="sm" onClick={handleContinue} className="gap-2">
                            <Play className="h-4 w-4" />
                            Continuar
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
