import { useState, useMemo, useRef, useEffect } from "react";
import { useTenantId } from "@/hooks/useTenantId";
import { useIntegrationsSettings } from "@/hooks/useIntegrationsSettings";
import { useTenantDomain } from "@/hooks/useTenantDomain";
import { useQuery } from "@tanstack/react-query";
import {
  Send,
  Users,
  Calendar,
  Target,
  UserCheck,
  Loader2,
  AlertCircle,
  Clock,
  ClipboardList,
  Layers,
  Play,
} from "lucide-react";
import { useBulkSendSession } from "@/hooks/useBulkSendSession";
import { ResumeSessionAlert } from "@/components/bulk-send/ResumeSessionAlert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useWhatsAppTemplates,
  replaceTemplateVariables,
} from "@/hooks/useWhatsAppTemplates";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getProductionUrl, getTenantBaseUrl, generateEventAffiliateUrl, generateAffiliateUrl, generateLeaderReferralUrl, generateSurveyAffiliateUrl, generateLeaderVerificationUrl, generateVerificationUrl } from "@/lib/urlHelper";

type RecipientType = "leaders" | "event_contacts" | "funnel_contacts" | "all_contacts" | "single_contact" | "single_leader" | "unverified_contacts" | "recent_interactions";

// Templates que precisam de evento destino
const EVENT_INVITE_TEMPLATES = ["evento-convite", "lideranca-evento-link"];
// Templates que precisam de funil destino
const FUNNEL_INVITE_TEMPLATES = ["captacao-convite"];
// Templates que precisam de pesquisa destino
const SURVEY_INVITE_TEMPLATES = ["pesquisa-convite", "lideranca-pesquisa-link"];
// Templates de links de afiliado (apenas para líderes, sem necessidade de destino)
const LEADER_AFFILIATE_LINK_TEMPLATES = ["lideranca-reuniao-link", "lideranca-cadastro-link"];
// Templates de verificação (para contatos não verificados)
const VERIFICATION_TEMPLATES = ["verificacao-cadastro"];
// Templates para envio via Cloud API (janela 24h)
const CLOUD_API_TEMPLATES = ["habita-amapa-2026-cloud"];

// Templates de convite permitidos por tipo de destinatário
const CONVITE_TEMPLATES_LEADERS = [
  "evento-convite",
  "captacao-convite",
  "lideranca-evento-link",
  "pesquisa-convite",
  "lideranca-pesquisa-link",
  "lideranca-reuniao-link",
  "lideranca-cadastro-link",
];

const CONVITE_TEMPLATES_CONTACTS = [
  "evento-convite",
  "captacao-convite",
  "pesquisa-convite",
];

// Opções de tamanho de lote
const BATCH_SIZE_OPTIONS = [
  { value: "10", label: "10 por vez" },
  { value: "20", label: "20 por vez" },
  { value: "30", label: "30 por vez" },
  { value: "50", label: "50 por vez" },
  { value: "100", label: "100 por vez" },
  { value: "all", label: "Todos de uma vez" },
];

export function WhatsAppBulkSendTab() {
  const tenantId = useTenantId();
  const tenantDomain = useTenantDomain();
  const { data: intSettings } = useIntegrationsSettings();
  const [recipientType, setRecipientType] = useState<RecipientType>("all_contacts");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedFunnel, setSelectedFunnel] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedCloudNumber, setSelectedCloudNumber] = useState<"1" | "2">("1");
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // Estados para controle de lotes
  const [batchSize, setBatchSize] = useState("20");
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const continueResolve = useRef<(() => void) | null>(null);

  // Estados para evento/funil/pesquisa DESTINO (para preencher variáveis)
  const [targetEventId, setTargetEventId] = useState("");
  const [targetFunnelId, setTargetFunnelId] = useState("");
  const [targetSurveyId, setTargetSurveyId] = useState("");

  // Estados para envio individual
  const [singleContactSearch, setSingleContactSearch] = useState("");
  const [selectedSingleContact, setSelectedSingleContact] = useState<{id: string; nome: string; telefone_norm: string} | null>(null);
  const [selectedSingleLeader, setSelectedSingleLeader] = useState<{id: string; nome_completo: string; telefone: string; affiliate_token: string | null} | null>(null);

  // Hook de sessão para retomada
  const {
    pendingSession,
    showResumeDialog,
    startSession,
    markSent,
    getSentIdentifiers,
    clearSession,
    dismissDialog,
  } = useBulkSendSession("whatsapp");

  // Estado para controle de retomada
  const [isResuming, setIsResuming] = useState(false);

  // Delay aleatório entre 3-6 segundos para parecer mais humano e evitar bloqueio
  const getRandomDelay = () => {
    const minDelay = 3000; // 3 segundos
    const maxDelay = 6000; // 6 segundos
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  };

  // Função para continuar envio após pausa
  const handleContinue = () => {
    if (continueResolve.current) {
      continueResolve.current();
      continueResolve.current = null;
    }
    setIsPaused(false);
  };

  const { data: templates } = useWhatsAppTemplates();

  // Detectar tipo do template selecionado
  const selectedTemplateData = templates?.find((t) => t.id === selectedTemplate);
  const isEventInviteTemplate = selectedTemplateData && EVENT_INVITE_TEMPLATES.includes(selectedTemplateData.slug);
  const isFunnelInviteTemplate = selectedTemplateData && FUNNEL_INVITE_TEMPLATES.includes(selectedTemplateData.slug);
  const isSurveyInviteTemplate = selectedTemplateData && SURVEY_INVITE_TEMPLATES.includes(selectedTemplateData.slug);
  const isLeaderAffiliateLinkTemplate = selectedTemplateData && LEADER_AFFILIATE_LINK_TEMPLATES.includes(selectedTemplateData.slug);
  const isVerificationTemplate = selectedTemplateData && VERIFICATION_TEMPLATES.includes(selectedTemplateData.slug);

  // Fetch events
  const { data: events } = useQuery({
    queryKey: ["events-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, slug, date, time, location, address, description, status")
        .eq("status", "active")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch funnels
  const { data: funnels } = useQuery({
    queryKey: ["funnels-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_funnels")
        .select("id, nome, slug, lead_magnet_nome, descricao")
        .eq("status", "active")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch surveys
  const { data: surveys } = useQuery({
    queryKey: ["surveys-active-whatsapp"],
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

  // Fetch target event details (para preencher variáveis)
  const { data: targetEvent } = useQuery({
    queryKey: ["target_event_whatsapp", targetEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, slug, date, time, location, address, description")
        .eq("id", targetEventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetEventId && !!isEventInviteTemplate,
  });

  // Fetch target funnel details (para preencher variáveis)
  const { data: targetFunnel } = useQuery({
    queryKey: ["target_funnel_whatsapp", targetFunnelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_funnels")
        .select("id, nome, slug, lead_magnet_nome, descricao, subtitulo")
        .eq("id", targetFunnelId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetFunnelId && !!isFunnelInviteTemplate,
  });

  // Fetch target survey details (para preencher variáveis)
  const { data: targetSurvey } = useQuery({
    queryKey: ["target_survey_whatsapp", targetSurveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("id, titulo, slug, descricao")
        .eq("id", targetSurveyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!targetSurveyId && !!isSurveyInviteTemplate,
  });

  // Buscar nome do deputado/organização (para template de reunião)
  const { data: organization } = useQuery({
    queryKey: ["organization-name-whatsapp"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization")
        .select("nome")
        .limit(1)
        .single();
      if (error) return { nome: "Deputado" };
      return data;
    },
  });

  // Buscar IDs de contatos promovidos (excluir do envio)
  const { data: promotedContactIds = [] } = useQuery({
    queryKey: ['promoted-contact-ids-whatsapp'],
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
    queryKey: ["contact-search-whatsapp", singleContactSearch, promotedContactIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_contacts")
        .select("id, nome, telefone_norm")
        .not("telefone_norm", "is", null)
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
    queryKey: ["leader-search-whatsapp", singleContactSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, telefone, affiliate_token")
        .eq("is_active", true)
        .not("telefone", "is", null)
        .ilike("nome_completo", `%${singleContactSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: recipientType === "single_leader" && singleContactSearch.length >= 2,
  });

  // Fetch recipients count based on selection
  const { data: recipientsData, isLoading: recipientsLoading } = useQuery({
    queryKey: ["whatsapp-recipients", recipientType, selectedEvent, selectedFunnel, selectedSingleContact?.id, selectedSingleLeader?.id, promotedContactIds],
    queryFn: async () => {
      if (recipientType === "single_contact" && selectedSingleContact) {
        return { count: 1, recipients: [selectedSingleContact] };
      }

      if (recipientType === "single_leader" && selectedSingleLeader) {
        return { count: 1, recipients: [selectedSingleLeader] };
      }

      if (recipientType === "leaders") {
        const { data, error } = await supabase
          .from("lideres")
          .select("id, nome_completo, telefone, affiliate_token")
          .eq("is_active", true)
          .not("telefone", "is", null);
        if (error) throw error;
        return { count: data?.length || 0, recipients: data || [] };
      }

      if (recipientType === "event_contacts" && selectedEvent) {
        const { data, error } = await supabase
          .from("event_registrations")
          .select("id, nome, whatsapp, contact_id")
          .eq("event_id", selectedEvent);
        if (error) throw error;
        return { count: data?.length || 0, recipients: data || [] };
      }

      if (recipientType === "funnel_contacts" && selectedFunnel) {
        const { data, error } = await supabase
          .from("office_contacts")
          .select("id, nome, telefone_norm")
          .eq("source_type", "captacao")
          .eq("source_id", selectedFunnel)
          .not("telefone_norm", "is", null);
        if (error) throw error;
        // Filtrar contatos promovidos
        const filteredData = (data || []).filter(c => !promotedContactIds.includes(c.id));
        return { count: filteredData.length, recipients: filteredData };
      }

      if (recipientType === "all_contacts") {
        const { data, error } = await supabase
          .from("office_contacts")
          .select("id, nome, telefone_norm")
          .not("telefone_norm", "is", null);
        if (error) throw error;
        // Filtrar contatos promovidos
        const filteredData = (data || []).filter(c => !promotedContactIds.includes(c.id));
        return { count: filteredData.length, recipients: filteredData };
      }

      if (recipientType === "unverified_contacts") {
        const { data, error } = await supabase
          .from("office_contacts")
          .select(`
            id, 
            nome, 
            telefone_norm, 
            verification_code,
            source_id,
            lideres!office_contacts_source_id_fkey (nome_completo)
          `)
          .eq("source_type", "lider")
          .eq("is_verified", false)
          .eq("is_active", true)
          .not("telefone_norm", "is", null)
          .not("source_id", "is", null);
        if (error) throw error;
        // Filtrar contatos promovidos
        const filteredData = (data || []).filter(c => !promotedContactIds.includes(c.id));
        return { count: filteredData.length, recipients: filteredData };
      }

      if (recipientType === "recent_interactions") {
        // Buscar telefones únicos via RPC (evita limite de 1000 linhas)
        const { data: recentPhonesJson, error: rpcError } = await supabase
          .rpc("get_recent_whatsapp_phones_json", { hours_ago: 24 });
        if (rpcError) throw rpcError;

        const phoneList = Array.isArray(recentPhonesJson)
          ? recentPhonesJson
          : [];

        const recipients = phoneList.map((phone: string) => ({
          id: phone,
          nome: "Contato",
          telefone_norm: phone,
        }));
        return { count: recipients.length, recipients };
      }

      return { count: 0, recipients: [] };
    },
    enabled:
      recipientType === "leaders" ||
      recipientType === "all_contacts" ||
      recipientType === "unverified_contacts" ||
      recipientType === "recent_interactions" ||
      (recipientType === "single_contact" && !!selectedSingleContact) ||
      (recipientType === "single_leader" && !!selectedSingleLeader) ||
      (recipientType === "event_contacts" && !!selectedEvent) ||
      (recipientType === "funnel_contacts" && !!selectedFunnel),
  });

  // Filter templates based on recipient type
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];

    const activeTemplates = templates.filter((t) => t.is_active);

    // Templates para interações recentes (Cloud API 24h)
    if (recipientType === "recent_interactions") {
      return activeTemplates.filter((t) => CLOUD_API_TEMPLATES.includes(t.slug));
    }

    // Templates de verificação para contatos não verificados
    if (recipientType === "unverified_contacts") {
      return activeTemplates.filter((t) => VERIFICATION_TEMPLATES.includes(t.slug));
    }

    // Para líder único: incluir templates de líderes + verificação
    if (recipientType === "single_leader") {
      return activeTemplates.filter((t) =>
        CONVITE_TEMPLATES_LEADERS.includes(t.slug) || VERIFICATION_TEMPLATES.includes(t.slug)
      );
    }

    if (recipientType === "leaders") {
      return activeTemplates.filter((t) => CONVITE_TEMPLATES_LEADERS.includes(t.slug));
    }

    return activeTemplates.filter((t) => CONVITE_TEMPLATES_CONTACTS.includes(t.slug) || CLOUD_API_TEMPLATES.includes(t.slug));
  }, [templates, recipientType]);

  const canSend =
    selectedTemplate &&
    recipientsData &&
    recipientsData.count > 0 &&
    (recipientType === "leaders" ||
      recipientType === "all_contacts" ||
      recipientType === "unverified_contacts" ||
      recipientType === "recent_interactions" ||
      (recipientType === "single_contact" && selectedSingleContact) ||
      (recipientType === "single_leader" && selectedSingleLeader) ||
      (recipientType === "event_contacts" && selectedEvent) ||
      (recipientType === "funnel_contacts" && selectedFunnel)) &&
    (!isEventInviteTemplate || targetEventId) &&
    (!isFunnelInviteTemplate || targetFunnelId) &&
    (!isSurveyInviteTemplate || targetSurveyId);

  const handleSend = async (resumeMode = false) => {
    if (!canSend || !selectedTemplateData) return;

    setIsSending(true);
    setIsPaused(false);
    setCurrentBatch(0);
    let successCount = 0;
    let errorCount = 0;

    // SEMPRE usa URL de produção para comunicações externas
    const baseUrl = getTenantBaseUrl(tenantDomain);

    try {
      const recipients = recipientsData.recipients as Record<string, unknown>[];

      // Obter identificadores já enviados via localStorage (para retomada de sessão)
      const localStorageSent = resumeMode || isResuming ? getSentIdentifiers() : new Set<string>();

      // VERIFICAÇÃO DE DUPLICATAS VIA BANCO DE DADOS
      // Buscar telefones que já receberam mensagem com este template específico
      let dbSentPhones = new Set<string>();
      try {
        const { data: existingMessages } = await supabase
          .from("whatsapp_messages")
          .select("phone")
          .ilike("message", `%${selectedTemplateData.slug}%`)
          .in("status", ["sent", "delivered", "read"]);

        if (existingMessages && existingMessages.length > 0) {
          // Normalizar telefones removendo + para comparação
          dbSentPhones = new Set(existingMessages.map(m => m.phone.replace(/\+/g, "")));
          console.log(`[WhatsApp Bulk] ${dbSentPhones.size} telefones já receberam o template ${selectedTemplateData.slug}`);
        }
      } catch (dbError) {
        console.warn("[WhatsApp Bulk] Erro ao verificar duplicatas no banco:", dbError);
        // Continua mesmo com erro - é apenas uma verificação adicional
      }

      // Combinar identificadores de localStorage + banco de dados
      const allSentIdentifiers = new Set([...localStorageSent, ...dbSentPhones]);

      // Filtrar recipients que ainda não receberam (verificação dupla)
      const pendingRecipients = recipients.filter(r => {
        const phone = (r.telefone as string) || (r.telefone_norm as string) || (r.whatsapp as string);
        if (!phone) return false;
        // Normalizar telefone para comparação
        const normalizedPhone = phone.replace(/\+/g, "");
        return !allSentIdentifiers.has(phone) && !allSentIdentifiers.has(normalizedPhone);
      });

      const totalRecipients = pendingRecipients.length;

      if (totalRecipients === 0) {
        toast.info("Todos os destinatários já receberam a mensagem");
        clearSession();
        setIsSending(false);
        return;
      }

      // Iniciar nova sessão se não estiver retomando
      if (!resumeMode && !isResuming) {
        startSession(
          selectedTemplate,
          selectedTemplateData.slug,
          selectedTemplateData.nome,
          recipientType,
          recipients.length,
          batchSize,
          targetEventId || undefined,
          targetFunnelId || undefined,
          targetSurveyId || undefined
        );
      }

      const batchSizeNum = batchSize === "all" ? totalRecipients : parseInt(batchSize);
      const numBatches = Math.ceil(totalRecipients / batchSizeNum);
      setTotalBatches(numBatches);
      setSendProgress({ current: 0, total: totalRecipients });

      for (let batch = 0; batch < numBatches; batch++) {
        setCurrentBatch(batch + 1);
        const start = batch * batchSizeNum;
        const end = Math.min(start + batchSizeNum, totalRecipients);
        const batchRecipients = pendingRecipients.slice(start, end);

        for (let i = 0; i < batchRecipients.length; i++) {
          const globalIndex = start + i;
          const recipient = batchRecipients[i];
          let phone: string | null = null;
          let nome: string = "Visitante";
          let contactId: string | null = null;

          if (recipientType === "leaders" || recipientType === "single_leader") {
            phone = recipient.telefone as string;
            nome = (recipient.nome_completo as string) || "Líder";
            contactId = null;
          } else if (recipientType === "event_contacts") {
            phone = recipient.whatsapp as string;
            nome = (recipient.nome as string) || "Visitante";
            contactId = (recipient.contact_id as string) || (recipient.id as string);
          } else {
            phone = recipient.telefone_norm as string;
            nome = (recipient.nome as string) || "Visitante";
            contactId = recipient.id as string;
          }

          if (!phone) continue;

          // Construir variáveis baseado no tipo de template
          const variables: Record<string, string> = {
            nome,
          };

          // Se for template de evento, adicionar variáveis do evento destino
          if (isEventInviteTemplate && targetEvent) {
            variables.evento_nome = targetEvent.name;
            variables.evento_data = format(new Date(targetEvent.date), "dd 'de' MMMM", { locale: ptBR });
            variables.evento_hora = targetEvent.time;
            variables.evento_local = targetEvent.location;
            variables.evento_endereco = targetEvent.address || "";
            variables.evento_descricao = targetEvent.description || "";
            variables.link_inscricao = `${baseUrl}/eventos/${targetEvent.slug}`;

            // Se for líder, gerar link_afiliado exclusivo
            if ((recipientType === "leaders" || recipientType === "single_leader") && recipient.affiliate_token) {
              variables.link_afiliado = generateEventAffiliateUrl(targetEvent.slug, recipient.affiliate_token as string);
            }
          }

          // Se for template de captação, adicionar variáveis do funil destino
          if (isFunnelInviteTemplate && targetFunnel) {
            variables.material_nome = targetFunnel.lead_magnet_nome;
            variables.material_descricao = targetFunnel.subtitulo || "";
            variables.link_captacao = `${baseUrl}/captacao/${targetFunnel.slug}`;
          }

          // Se for template de pesquisa, adicionar variáveis da pesquisa destino
          if (isSurveyInviteTemplate && targetSurvey) {
            variables.pesquisa_titulo = targetSurvey.titulo;
            variables.pesquisa_descricao = targetSurvey.descricao || "";
            variables.link_pesquisa = `${baseUrl}/pesquisa/${targetSurvey.slug}`;

            // Se for líder e template lideranca-pesquisa-link, gerar link_pesquisa_afiliado
            if ((recipientType === "leaders" || recipientType === "single_leader") && recipient.affiliate_token && selectedTemplateData.slug === "lideranca-pesquisa-link") {
              variables.link_pesquisa_afiliado = generateSurveyAffiliateUrl(targetSurvey.slug, recipient.affiliate_token as string);
            }
          }

          // Se for template de verificação (contatos não verificados ou líder único)
          if (isVerificationTemplate && (recipientType === "unverified_contacts" || recipientType === "single_leader")) {
            // Gerar ou obter código de verificação
            let verificationCode: string;

            const recipientId = recipient.id as string;

            if (recipientType === "single_leader") {
              // Para líder único, buscar ou gerar código do líder
              const { data: leaderData } = await supabase
                .from("lideres")
                .select("verification_code")
                .eq("id", recipientId)
                .single();

              verificationCode = leaderData?.verification_code || null;

              if (!verificationCode) {
                const codeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                verificationCode = Array(6).fill(0).map(() => codeChars.charAt(Math.floor(Math.random() * codeChars.length))).join("");
              }

              if (!leaderData?.verification_code) {
                await supabase
                  .from("lideres")
                  .update({ verification_code: verificationCode })
                  .eq("id", recipientId);
              }
            } else {
              // Para contatos não verificados
              verificationCode = recipient.verification_code as string;
              if (!verificationCode) {
                const codeChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                verificationCode = Array(6).fill(0).map(() => codeChars.charAt(Math.floor(Math.random() * codeChars.length))).join("");
                await supabase
                  .from("office_contacts")
                  .update({ verification_code: verificationCode })
                  .eq("id", recipientId);
              }
            }

            variables.deputado_nome = organization?.nome || "Deputado";
            variables.codigo = verificationCode;

            const message = replaceTemplateVariables(selectedTemplateData.mensagem, variables);

            try {
              // Enviar mensagem principal de verificação
              const { data: mainResult, error: mainError } = await supabase.functions.invoke("send-whatsapp", {
                body: {
                  phone,
                  message,
                  contactId,
                  tenantId,
                },
              });

              if (mainError || !mainResult?.success) {
                errorCount++;
              } else {
                // Aguardar 2 segundos e enviar o código separadamente
                await new Promise((resolve) => setTimeout(resolve, 2000));

                // Enviar mensagem com o código
                const codigoMessage = `🔑 *Seu código de verificação:*\n\n*${verificationCode}*\n\nResponda esta mensagem com o código acima para confirmar seu cadastro.`;

                await supabase.functions.invoke("send-whatsapp", {
                  body: {
                    phone,
                    message: codigoMessage,
                    contactId,
                    tenantId,
                  },
                });

                // Atualizar verification_sent_at
                if (recipientType === "single_leader") {
                  await supabase
                    .from("lideres")
                    .update({ verification_sent_at: new Date().toISOString() })
                    .eq("id", recipientId);
                } else {
                  await supabase
                    .from("office_contacts")
                    .update({ verification_sent_at: new Date().toISOString() })
                    .eq("id", recipientId);
                }

                successCount++;
                markSent(phone);
              }

              setSendProgress({ current: globalIndex + 1, total: totalRecipients });

              if (i < batchRecipients.length - 1 || batch < numBatches - 1) {
                await new Promise((resolve) => setTimeout(resolve, getRandomDelay()));
              }
              continue; // Pular o envio padrão abaixo
            } catch (verifyError) {
              console.error("Erro ao enviar verificação:", verifyError);
              errorCount++;
              continue;
            }
          }

          // Se for template de link de afiliado para líder (reunião ou cadastro)
          if (isLeaderAffiliateLinkTemplate && (recipientType === "leaders" || recipientType === "single_leader") && recipient.affiliate_token) {
            const affiliateToken = recipient.affiliate_token as string;

            if (selectedTemplateData.slug === "lideranca-reuniao-link") {
              variables.deputado_nome = organization?.nome || "Deputado";
              variables.link_reuniao_afiliado = generateAffiliateUrl(affiliateToken, tenantDomain);
            }

            if (selectedTemplateData.slug === "lideranca-cadastro-link") {
              const linkCadastroAfiliado = generateLeaderReferralUrl(affiliateToken, tenantDomain);
              variables.link_cadastro_afiliado = linkCadastroAfiliado;

              // Gerar QR code e enviar junto com a mensagem
              try {
                const QRCode = (await import('qrcode')).default;
                const qrCodeDataUrl = await QRCode.toDataURL(linkCadastroAfiliado, { width: 300 });
                const message = replaceTemplateVariables(selectedTemplateData.mensagem, variables);

                const { data, error } = await supabase.functions.invoke("send-whatsapp", {
                  body: {
                    phone,
                    message,
                    contactId,
                    imageUrl: qrCodeDataUrl,
                    tenantId,
                  },
                });

                if (error || !data?.success) {
                  errorCount++;
                } else {
                  successCount++;
                  markSent(phone);
                }

                setSendProgress({ current: globalIndex + 1, total: totalRecipients });

                if (i < batchRecipients.length - 1 || batch < numBatches - 1) {
                  await new Promise((resolve) => setTimeout(resolve, getRandomDelay()));
                }
                continue; // Pular o envio padrão abaixo
              } catch (qrError) {
                console.error("Erro ao gerar QR code:", qrError);
                // Continua para envio sem QR code
              }
            }
          }

          const message = replaceTemplateVariables(selectedTemplateData.mensagem, variables);

          try {
            const { data, error } = await supabase.functions.invoke("send-whatsapp", {
              body: {
                phone,
                message,
                contactId,
                tenantId,
                ...(recipientType === "recent_interactions" ? { providerOverride: "meta_cloud" } : {}),
              },
            });

            if (error || !data?.success) {
              errorCount++;
            } else {
              successCount++;
              // Marcar como enviado para persistência
              markSent(phone);

              // Se for template lideranca-evento-link, enviar link em mensagem separada
              if (selectedTemplateData.slug === "lideranca-evento-link" && variables.link_afiliado) {
                await new Promise((resolve) => setTimeout(resolve, 2000)); // Delay de 2s
                await supabase.functions.invoke("send-whatsapp", {
                  body: {
                    phone,
                    message: variables.link_afiliado,
                    contactId,
                    tenantId,
                  },
                });
              }
            }
          } catch (err) {
            errorCount++;
          }

          // Atualizar progresso
          setSendProgress({ current: globalIndex + 1, total: totalRecipients });

          // Delay aleatório entre 3-6 segundos (exceto na última mensagem do último lote)
          if (i < batchRecipients.length - 1 || batch < numBatches - 1) {
            await new Promise((resolve) => setTimeout(resolve, getRandomDelay()));
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
        toast.success(`${successCount} mensagens enviadas com sucesso!`);
        // Limpar sessão quando concluir com sucesso
        clearSession();
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} mensagens falharam`);
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
      setIsResuming(false);
    }
  };

  // Handlers para retomada
  const handleResumeSession = () => {
    if (pendingSession) {
      setSelectedTemplate(pendingSession.templateId);
      setBatchSize(pendingSession.batchSize);
      setTargetEventId(pendingSession.targetEventId || "");
      setTargetFunnelId(pendingSession.targetFunnelId || "");
      setTargetSurveyId(pendingSession.targetSurveyId || "");
      setRecipientType(pendingSession.recipientType as RecipientType);
      setIsResuming(true);
      dismissDialog();
      // Enviar será chamado manualmente pelo usuário após configuração
    }
  };

  const handleDiscardSession = () => {
    clearSession();
    setIsResuming(false);
  };

  // Calcular tempo estimado em minutos (média de 4.5 segundos por mensagem)
  const estimatedMinutes = Math.ceil((recipientsData?.count || 0) * 4.5 / 60);

  return (
    <div className="space-y-6">
      {/* Alert de sessão pendente */}
      {showResumeDialog && pendingSession && (
        <ResumeSessionAlert
          session={pendingSession}
          onResume={handleResumeSession}
          onDiscard={handleDiscardSession}
          onDismiss={dismissDialog}
        />
      )}
      {selectedTemplateData && CLOUD_API_TEMPLATES.includes(selectedTemplateData.slug) && (
        <Alert className="border-green-200 bg-green-50">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="space-y-1 text-green-800">
            <p>
              <strong>Cloud API — Janela de 24h:</strong> Este template será enviado via Meta Cloud API. Apenas contatos que interagiram nas últimas 24 horas poderão receber a mensagem.
            </p>
            {recipientType === "recent_interactions" && (
              <p className="flex items-center gap-1 text-sm font-medium mt-1">
                <Users className="h-4 w-4" />
                {recipientsLoading ? (
                  <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Carregando...</span>
                ) : (
                  <span>{recipientsData?.count || 0} contato(s) habilitado(s) para envio (janela 24h ativa)</span>
                )}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-1">
          <p>
            Certifique-se de que a integração Z-API está configurada e ativa antes de
            realizar envios em massa.
          </p>
          {(recipientsData?.count || 0) > 0 && (
            <p className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Intervalo de 3-6 segundos entre mensagens para evitar bloqueios.
              {estimatedMinutes > 0 && (
                <span className="font-medium">
                  {" "}Tempo estimado: ~{estimatedMinutes} min
                </span>
              )}
            </p>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recipient Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Destinatários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                O envio será pausado a cada {batchSize === "all" ? "término" : batchSize} mensagens para revisão
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Destinatário</Label>
              <Select
                value={recipientType}
                onValueChange={(value) => {
                  setRecipientType(value as RecipientType);
                  setSelectedEvent("");
                  setSelectedFunnel("");
                  setSelectedTemplate("");
                  setTargetEventId("");
                  setTargetFunnelId("");
                  setTargetSurveyId("");
                  setSelectedSingleContact(null);
                  setSelectedSingleLeader(null);
                  setSingleContactSearch("");
                }}
                disabled={isSending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_contact">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Contato Único
                    </div>
                  </SelectItem>
                  <SelectItem value="single_leader">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Líder Único
                    </div>
                  </SelectItem>
                  <SelectItem value="all_contacts">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todos os Contatos (com telefone)
                    </div>
                  </SelectItem>
                  <SelectItem value="leaders">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Todos os Líderes
                    </div>
                  </SelectItem>
                  <SelectItem value="event_contacts">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Contatos de Evento Específico
                    </div>
                  </SelectItem>
                  <SelectItem value="funnel_contacts">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Contatos de Funil de Captação
                    </div>
                  </SelectItem>
                  <SelectItem value="unverified_contacts">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Contatos Não Verificados
                    </div>
                  </SelectItem>
                  <SelectItem value="recent_interactions">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Interações últimas 24h (Cloud API)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                        <p className="text-xs text-muted-foreground">{contact.telefone_norm}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedSingleContact && (
                  <div className="p-2 bg-muted rounded-md text-sm">
                    <p className="font-medium">{selectedSingleContact.nome}</p>
                    <p className="text-muted-foreground">{selectedSingleContact.telefone_norm}</p>
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
                        <p className="text-xs text-muted-foreground">{leader.telefone}</p>
                      </button>
                    ))}
                  </div>
                )}
                {selectedSingleLeader && (
                  <div className="p-2 bg-muted rounded-md text-sm">
                    <p className="font-medium">{selectedSingleLeader.nome_completo}</p>
                    <p className="text-muted-foreground">{selectedSingleLeader.telefone}</p>
                  </div>
                )}
              </div>
            )}

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

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Destinatários selecionados:
                </span>
                {recipientsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Badge variant="secondary">{recipientsData?.count || 0}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              Template da Mensagem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Selecione o Template</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(v) => {
                  setSelectedTemplate(v);
                  setTargetEventId("");
                  setTargetFunnelId("");
                  setTargetSurveyId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um template" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
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

            {selectedTemplateData && (
              <div className="rounded-lg border p-3 bg-muted/50">
                <Label className="text-xs font-medium">Pré-visualização</Label>
                <div className="mt-2 p-2 bg-background rounded text-sm whitespace-pre-wrap">
                  {selectedTemplateData.mensagem}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.isArray(selectedTemplateData.variaveis) && selectedTemplateData.variaveis.map((v, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary and Send Button */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Progress bar during sending */}
          {isSending && sendProgress.total > 0 && (
            <div className="space-y-3">
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
                  {sendProgress.current} de {sendProgress.total} mensagens
                </span>
              </div>
              <Progress
                value={(sendProgress.current / sendProgress.total) * 100}
                className="h-2"
              />

              {isPaused ? (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-amber-800">
                      ✅ Lote {currentBatch} concluído! Pronto para enviar lote {currentBatch + 1}?
                    </span>
                    <Button size="sm" onClick={handleContinue} className="gap-2">
                      <Play className="h-4 w-4" />
                      Continuar envio
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Tempo restante estimado: ~{Math.ceil((sendProgress.total - sendProgress.current) * 4.5 / 60)} min
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">
                {recipientsData?.count || 0} destinatários selecionados
              </p>
              {isEventInviteTemplate && targetEvent && (
                <p className="text-sm font-medium">
                  Convite para: {targetEvent.name}
                </p>
              )}
              {isFunnelInviteTemplate && targetFunnel && (
                <p className="text-sm font-medium">
                  Convite para: {targetFunnel.lead_magnet_nome}
                </p>
              )}
              {isSurveyInviteTemplate && targetSurvey && (
                <p className="text-sm font-medium">
                  Convite para: {targetSurvey.titulo}
                </p>
              )}
            </div>
            <Button
              size="lg"
              onClick={() => handleSend(isResuming)}
              disabled={!canSend || isSending}
              className="min-w-[200px]"
            >
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {sendProgress.current}/{sendProgress.total}
                </>
              ) : isResuming ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Retomar envio ({pendingSession ? pendingSession.totalRecipients - pendingSession.sentIdentifiers.length : 0} pendentes)
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {recipientsData?.count || 0} destinatários
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
