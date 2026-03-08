import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Send, Users, Calendar, Filter, MessageSquare, AlertCircle, User, UserCheck, X, ShieldCheck, ShieldAlert, Clock, Network, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSMSTemplates, replaceTemplateVariables } from "@/hooks/useSMSTemplates";
import { useEvents } from "@/hooks/events/useEvents";
import { useCreateScheduledMessages } from "@/hooks/useScheduledMessages";
import { ScheduleMessageDialog } from "@/components/scheduling/ScheduleMessageDialog";
import { useRegionMaterials } from "@/hooks/useRegionMaterials";
import { toast } from "sonner";
import { format } from "date-fns";
import { generateVerificationUrl, generateLeaderReferralUrl, generateLeaderVerificationUrl, getProductionUrl } from "@/lib/urlHelper";

type RecipientType = "contacts" | "leaders" | "event" | "single_contact" | "single_leader" | "sms_not_sent" | "waiting_verification" | "coordinator_tree";
type BatchSize = "10" | "20" | "30" | "50" | "100" | "all";

interface SinglePerson {
  id: string;
  nome: string;
  phone: string;
  verification_code?: string | null;
  affiliate_token?: string | null;
}

const BATCH_SIZES: { value: BatchSize; label: string }[] = [
  { value: "10", label: "10 por lote" },
  { value: "20", label: "20 por lote" },
  { value: "30", label: "30 por lote" },
  { value: "50", label: "50 por lote" },
  { value: "100", label: "100 por lote" },
  { value: "all", label: "Todos de uma vez" },
];

function getRandomDelay(): number {
  return Math.floor(Math.random() * (6000 - 3000 + 1)) + 3000;
}

export function SMSBulkSendTab() {
  const { data: templates } = useSMSTemplates();
  const { data: events } = useEvents();
  const { data: regionMaterials } = useRegionMaterials();
  const createScheduledMessages = useCreateScheduledMessages();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedMaterialUrl, setSelectedMaterialUrl] = useState<string>("");
  const [recipientType, setRecipientType] = useState<RecipientType>("contacts");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [batchSize, setBatchSize] = useState<BatchSize>("20");
  
  // Single person states
  const [singleSearch, setSingleSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<SinglePerson | null>(null);
  
  // Coordinator tree states
  const [coordinatorSearch, setCoordinatorSearch] = useState("");
  const [selectedCoordinator, setSelectedCoordinator] = useState<{
    id: string;
    nome_completo: string;
    total_in_tree: number;
    unverified_count: number;
  } | null>(null);
  
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [waitingForConfirmation, setWaitingForConfirmation] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const activeTemplates = templates?.filter((t) => t.is_active) || [];
  const selectedTemplateData = templates?.find((t) => t.slug === selectedTemplate);
  const isSingleSend = recipientType === "single_contact" || recipientType === "single_leader";
  const isVerificationType = recipientType === "sms_not_sent" || recipientType === "waiting_verification" || recipientType === "coordinator_tree";

  // Verificar se o template requer seleção de material
  const templateRequiresMaterial = selectedTemplate === "material-regiao-sms" || 
    (selectedTemplateData?.variaveis as string[] | null)?.includes("link_material");

  // Search contacts (include verification_code for SMS verification links)
  const { data: contactSearchResults } = useQuery({
    queryKey: ["sms-contact-search", singleSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_contacts")
        .select("id, nome, telefone_norm, verification_code")
        .eq("is_active", true)
        .not("telefone_norm", "is", null)
        .ilike("nome", `%${singleSearch}%`)
        .limit(10);
      if (error) throw error;
      return data?.map((c) => ({ id: c.id, nome: c.nome, phone: c.telefone_norm, verification_code: c.verification_code })) || [];
    },
    enabled: recipientType === "single_contact" && singleSearch.length >= 2 && !selectedPerson,
  });

  // Search leaders
  const { data: leaderSearchResults } = useQuery({
    queryKey: ["sms-leader-search", singleSearch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lideres")
        .select("id, nome_completo, telefone, affiliate_token, verification_code")
        .eq("is_active", true)
        .not("telefone", "is", null)
        .ilike("nome_completo", `%${singleSearch}%`)
        .limit(10);
      if (error) throw error;
      return data?.map((l) => ({
        id: l.id,
        nome: l.nome_completo,
        phone: l.telefone!,
        affiliate_token: l.affiliate_token,
        verification_code: l.verification_code,
      })) || [];
    },
    enabled: recipientType === "single_leader" && singleSearch.length >= 2 && !selectedPerson,
  });

  // Search coordinators for tree selection
  const { data: coordinatorSearchResults } = useQuery({
    queryKey: ["coordinator-search-sms", coordinatorSearch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_coordinators_with_unverified_count_sms', {
        search_term: coordinatorSearch
      });
      if (error) throw error;
      return data as { id: string; nome_completo: string; total_in_tree: number; unverified_count: number }[];
    },
    enabled: recipientType === "coordinator_tree" && coordinatorSearch.length >= 2,
  });

  const searchResults = recipientType === "single_contact" ? contactSearchResults : leaderSearchResults;

  // Fetch recipients based on type
  // Query para buscar telefones que já receberam SMS nos últimos 7 dias com o mesmo padrão de mensagem
  const { data: recentRecipientPhones } = useQuery({
    queryKey: ["sms-recent-recipients-7days", recipientType, selectedTemplate],
    queryFn: async () => {
      // Calcular data de 7 dias atrás
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Determinar padrão de mensagem baseado no tipo de destinatário
      let messagePattern = "";
      if (recipientType === "waiting_verification" || recipientType === "sms_not_sent" || recipientType === "coordinator_tree") {
        messagePattern = "%verificar-lider%"; // Padrão para verificação de líderes
      } else if (selectedTemplate) {
        // Buscar o template selecionado para extrair palavras-chave
        const template = templates?.find(t => t.slug === selectedTemplate);
        if (template) {
          // Usa as primeiras palavras da mensagem como padrão
          const firstWords = template.mensagem.substring(0, 30);
          messagePattern = `%${firstWords}%`;
        }
      }
      
      if (!messagePattern) return new Set<string>();
      
      // Buscar telefones com paginação
      const allPhones: string[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
          .from("sms_messages")
          .select("phone")
          .eq("direction", "outgoing")
          .gte("created_at", sevenDaysAgo.toISOString())
          .ilike("message", messagePattern)
          .range(from, to);
        
        if (error) throw error;

        if (data && data.length > 0) {
          allPhones.push(...data.map(m => m.phone));
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return new Set(allPhones);
    },
    enabled: !!(recipientType && (isVerificationType || selectedTemplate)),
  });

  const { data: recipients, isLoading: loadingRecipients } = useQuery({
    queryKey: ["sms-recipients", recipientType, selectedEvent, selectedPerson?.id, selectedCoordinator?.id],
    queryFn: async () => {
      if (isSingleSend && selectedPerson) {
        return [{ id: selectedPerson.id, nome: selectedPerson.nome, phone: selectedPerson.phone, email: null, verification_code: selectedPerson.verification_code || null, affiliate_token: selectedPerson.affiliate_token || null }];
      }
      if (recipientType === "contacts") {
        // Buscar contatos com paginação para ultrapassar limite de 1000
        const allData: { id: string; nome: string; telefone_norm: string; email: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase
            .from("office_contacts")
            .select("id, nome, telefone_norm, email")
            .eq("is_active", true)
            .not("telefone_norm", "is", null)
            .range(from, to);
          
          if (error) throw error;

          if (data && data.length > 0) {
            allData.push(...data);
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        return allData.map((c) => ({
          id: c.id,
          nome: c.nome,
          phone: c.telefone_norm,
          email: c.email,
          verification_code: null,
          affiliate_token: null,
        }));
      } else if (recipientType === "leaders") {
        // Buscar líderes com paginação para ultrapassar limite de 1000
        const allData: { id: string; nome_completo: string; telefone: string | null; email: string | null; affiliate_token: string | null; verification_code: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase
            .from("lideres")
            .select("id, nome_completo, telefone, email, affiliate_token, verification_code")
            .eq("is_active", true)
            .not("telefone", "is", null)
            .range(from, to);
          
          if (error) throw error;

          if (data && data.length > 0) {
            allData.push(...data);
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        return allData.map((l) => ({
          id: l.id,
          nome: l.nome_completo,
          phone: l.telefone,
          email: l.email,
          verification_code: l.verification_code,
          affiliate_token: l.affiliate_token,
        }));
      } else if (recipientType === "event" && selectedEvent) {
        const { data, error } = await supabase
          .from("event_registrations")
          .select("id, nome, whatsapp, email")
          .eq("event_id", selectedEvent);
        if (error) throw error;
        return data.map((r) => ({
          id: r.id,
          nome: r.nome,
          phone: r.whatsapp,
          email: r.email,
          verification_code: null,
          affiliate_token: null,
        }));
      } else if (recipientType === "sms_not_sent") {
        // Líderes que NUNCA receberam SMS de verificação (verification_sent_at IS NULL)
        // Buscar com paginação para ultrapassar limite de 1000
        const allData: { id: string; nome_completo: string; telefone: string | null; email: string | null; verification_code: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase
            .from("lideres")
            .select("id, nome_completo, telefone, email, verification_code")
            .eq("is_active", true)
            .eq("is_verified", false)
            .not("telefone", "is", null)
            .is("verification_sent_at", null)
            .range(from, to);
          
          if (error) throw error;

          if (data && data.length > 0) {
            allData.push(...data);
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        return allData.map((l) => ({
          id: l.id,
          nome: l.nome_completo,
          phone: l.telefone,
          email: l.email,
          verification_code: l.verification_code,
          affiliate_token: null,
        }));
      } else if (recipientType === "waiting_verification") {
        // Líderes que já receberam SMS mas ainda não verificaram
        // Buscar com paginação para ultrapassar limite de 1000
        // Excluir líderes que já receberam SMS de verificação hoje (deduplicação diária)
        // Usar timezone de Brasília (GMT-3) para garantir consistência independente do navegador
        const getTodayStartBrasilia = (): string => {
          const now = new Date();
          const utcHours = now.getUTCHours();
          let targetDate = new Date(now);
          
          // Se em UTC são menos de 3h, em Brasília ainda é o dia anterior
          if (utcHours < 3) {
            targetDate.setUTCDate(targetDate.getUTCDate() - 1);
          }
          
          // Meia-noite de Brasília = 03:00 UTC
          targetDate.setUTCHours(3, 0, 0, 0);
          return targetDate.toISOString();
        };
        
        const todayStartBrasilia = getTodayStartBrasilia();
        
        const allData: { id: string; nome_completo: string; telefone: string | null; email: string | null; verification_code: string | null }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase
            .from("lideres")
            .select("id, nome_completo, telefone, email, verification_code")
            .eq("is_active", true)
            .eq("is_verified", false)
            .not("telefone", "is", null)
            .not("verification_sent_at", "is", null)
            .lt("verification_sent_at", todayStartBrasilia) // Exclui quem já recebeu hoje (Brasília GMT-3)
            .range(from, to);
          
          if (error) throw error;

          if (data && data.length > 0) {
            allData.push(...data);
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        return allData.map((l) => ({
          id: l.id,
          nome: l.nome_completo,
          phone: l.telefone,
          email: l.email,
          verification_code: l.verification_code,
          affiliate_token: null,
        }));
      } else if (recipientType === "coordinator_tree" && selectedCoordinator) {
        // Líderes não verificados na árvore do coordenador (com telefone)
        // Buscar com paginação para ultrapassar limite de 1000
        const allData: { id: string; nome_completo: string; telefone: string; verification_code: string }[] = [];
        const pageSize = 1000;
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const from = page * pageSize;
          const to = from + pageSize - 1;

          const { data, error } = await supabase.rpc('get_unverified_leaders_in_tree_sms', {
            coordinator_id: selectedCoordinator.id
          }).range(from, to);
          
          if (error) throw error;

          if (data && data.length > 0) {
            allData.push(...(data as { id: string; nome_completo: string; telefone: string; verification_code: string }[]));
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        return allData.map((l) => ({
          id: l.id,
          nome: l.nome_completo,
          phone: l.telefone,
          email: null,
          verification_code: l.verification_code,
          affiliate_token: null,
        }));
      }
      return [];
    },
    enabled: isSingleSend 
      ? !!selectedPerson 
      : recipientType === "coordinator_tree" 
        ? !!selectedCoordinator 
        : (recipientType !== "event" || !!selectedEvent),
  });

  // Calcular quantidade de duplicatas - destinatários que já receberam a mesma mensagem nos últimos 7 dias
  const duplicateInfo = useMemo(() => {
    if (!recipients || !recentRecipientPhones || recentRecipientPhones.size === 0) {
      return { count: 0, percentage: 0 };
    }
    
    // Função para normalizar telefone (remover +55 e outros caracteres não numéricos)
    const normalizePhone = (phone: string | null): string => {
      if (!phone) return "";
      return phone.replace(/^\+55/, "").replace(/\D/g, "");
    };
    
    const duplicateCount = recipients.filter(r => {
      if (!r.phone) return false;
      const normalizedPhone = normalizePhone(r.phone);
      return recentRecipientPhones.has(normalizedPhone);
    }).length;
    
    const percentage = recipients.length > 0 ? Math.round((duplicateCount / recipients.length) * 100) : 0;
    return { count: duplicateCount, percentage };
  }, [recipients, recentRecipientPhones]);

  // Função para encurtar URL usando a edge function
  const shortenUrl = async (url: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke("shorten-url", {
        body: { url },
      });
      
      if (error) throw error;
      return data.shortUrl;
    } catch (err) {
      console.error("Erro ao encurtar URL:", err);
      // Fallback: retorna URL original se falhar
      return url;
    }
  };

  const handleSendBulk = async () => {
    if ((!selectedTemplate && !isVerificationType) || !recipients || recipients.length === 0) {
      toast.error("Selecione um template e verifique os destinatários");
      return;
    }

    // Validar seleção de material quando necessário
    if (templateRequiresMaterial && !selectedMaterialUrl) {
      toast.error("Selecione um material para enviar");
      return;
    }

    setIsSending(true);
    setWaitingForConfirmation(false);
    setSentCount(0);
    
    // Encurtar link do material uma vez (reutilizado para todos os destinatários)
    let shortenedMaterialUrl = "";
    if (templateRequiresMaterial && selectedMaterialUrl) {
      toast.info("Encurtando link do material...");
      shortenedMaterialUrl = await shortenUrl(selectedMaterialUrl);
      console.log("Link encurtado:", shortenedMaterialUrl);
    }
    
    const batchSizeNum = batchSize === "all" ? recipients.length : parseInt(batchSize);
    const batches = Math.ceil(recipients.length / batchSizeNum);
    
    setTotalBatches(batches);
    setTotalCount(recipients.length);

    for (let batchIndex = currentBatch; batchIndex < batches; batchIndex++) {
      setCurrentBatch(batchIndex + 1);
      
      const start = batchIndex * batchSizeNum;
      const end = Math.min(start + batchSizeNum, recipients.length);
      const batchRecipients = recipients.slice(start, end);

      for (let i = 0; i < batchRecipients.length; i++) {
        const recipient = batchRecipients[i];
        
        try {
          const variables: Record<string, string> = {
            nome: recipient.nome || "",
            email: recipient.email || "",
            // Usar link encurtado quando disponível
            ...(shortenedMaterialUrl && { link_material: shortenedMaterialUrl }),
          };

          // Add leader affiliate link if applicable (SEMPRE usa URL de produção)
          if ((recipientType === "leaders" || recipientType === "single_leader") && recipient.affiliate_token) {
            variables.link_indicacao = generateLeaderReferralUrl(recipient.affiliate_token);
          }

          // Add event variables if applicable
          if (recipientType === "event" && selectedEvent) {
            const event = events?.find((e) => e.id === selectedEvent);
            if (event) {
              variables.evento_nome = event.name;
              variables.evento_data = format(new Date(event.date + "T00:00:00"), "dd/MM/yyyy");
              variables.evento_hora = event.time;
              variables.evento_local = event.location;
            }
          }

          // Decide template BEFORE building verification variables
          // (this matters when user manually selects verification templates)
          // Check recipient type for leader types before the isVerificationType narrowing
          const currentIsLeaderType = recipientType === "leaders" ||
                                      recipientType === "single_leader" ||
                                      recipientType === "sms_not_sent" ||
                                      recipientType === "waiting_verification" ||
                                      recipientType === "coordinator_tree";
          let templateToUse = selectedTemplate;
          if (isVerificationType) {
            templateToUse = currentIsLeaderType ? "verificacao-lider-sms" : "verificacao-link-sms";
          }

          const isLeaderVerificationTemplate = templateToUse === "verificacao-lider-sms";
          const isContactVerificationTemplate = templateToUse === "verificacao-link-sms";

          // Generate verification code if the chosen template needs it
          let verificationCode = recipient.verification_code;

          if (isLeaderVerificationTemplate && !verificationCode) {
            // Generate a 5-character alphanumeric code
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            verificationCode = Array(5)
              .fill(0)
              .map(() => chars.charAt(Math.floor(Math.random() * chars.length)))
              .join("");

            // Persist on leader record (so link works and future resend uses same code)
            await supabase
              .from("lideres")
              .update({
                verification_code: verificationCode,
                // mark as sent if it wasn't (helps downstream filters)
                verification_sent_at: new Date().toISOString(),
              })
              .eq("id", recipient.id);
          }

          // Add verification link when template expects it
          if (verificationCode && (isLeaderVerificationTemplate || isContactVerificationTemplate)) {
            variables.link_verificacao = isLeaderVerificationTemplate
              ? generateLeaderVerificationUrl(verificationCode)
              : generateVerificationUrl(verificationCode);
          }

          // Determine if recipient is a leader type (to pass leaderId for backend fallback)
          const isLeaderRecipient = recipientType === "leaders" || 
                                    recipientType === "single_leader" || 
                                    recipientType === "sms_not_sent" || 
                                    recipientType === "waiting_verification" || 
                                    recipientType === "coordinator_tree";

          const isContactRecipient = recipientType === "contacts" || recipientType === "single_contact";

          const { error } = await supabase.functions.invoke("send-sms", {
            body: {
              phone: recipient.phone,
              templateSlug: templateToUse,
              variables,
              // Pass leaderId or contactId to enable backend fallback for verification templates
              ...(isLeaderRecipient && { leaderId: recipient.id }),
              ...(isContactRecipient && { contactId: recipient.id }),
            },
          });

          if (error) throw error;
          actualSentCount++;
          setSentCount((prev) => prev + 1);
        } catch (error) {
          console.error("Error sending SMS:", error);
        }

        // Update progress
        const totalSent = start + i + 1;
        setSendProgress((totalSent / recipients.length) * 100);

        // Add delay between messages
        if (i < batchRecipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, getRandomDelay()));
        }
      }

      // After batch, wait for confirmation if not last batch
      if (batchIndex < batches - 1) {
        toast.success(`Lote ${batchIndex + 1} concluído!`);
        setWaitingForConfirmation(true);
        setIsSending(false);
        return;
      }
    }

    // All done
    toast.success(`Envio concluído! ${sentCount} mensagens enviadas.`);
    resetState();
  };

  const resetState = () => {
    setIsSending(false);
    setSendProgress(0);
    setCurrentBatch(0);
    setTotalBatches(0);
    setSentCount(0);
    setTotalCount(0);
    setWaitingForConfirmation(false);
  };

  const handleContinue = () => {
    handleSendBulk();
  };

  const handleCancel = () => {
    resetState();
  };

  const estimatedTime = recipients
    ? Math.ceil((recipients.length * 4.5) / 60)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Configuração do Envio
            </CardTitle>
            <CardDescription>
              Configure os parâmetros para o envio em massa de SMS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipientType !== "sms_not_sent" && recipientType !== "waiting_verification" && (
              <div className="space-y-2">
                <Label>Template SMS</Label>
                <Select 
                  value={selectedTemplate} 
                  onValueChange={(v) => {
                    setSelectedTemplate(v);
                    setSelectedMaterialUrl(""); // Limpar material ao trocar template
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((template) => (
                      <SelectItem key={template.slug} value={template.slug}>
                        {template.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Seletor de Material - aparece quando template usa {{link_material}} */}
            {templateRequiresMaterial && (
              <div className="space-y-2">
                <Label>Material (Link)</Label>
                <Select value={selectedMaterialUrl} onValueChange={setSelectedMaterialUrl}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o material" />
                  </SelectTrigger>
                  <SelectContent>
                    {regionMaterials?.filter(m => m.is_active).map((material) => (
                      <SelectItem key={material.id} value={material.material_url}>
                        {material.material_name} - {material.office_cities?.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(recipientType === "sms_not_sent" || recipientType === "waiting_verification") && (
              <Alert className="bg-amber-50 border-amber-200">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  {recipientType === "sms_not_sent" 
                    ? "Líderes que nunca receberam SMS de verificação. Códigos serão gerados automaticamente."
                    : "Líderes que já receberam SMS mas não verificaram."}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>Destinatários</Label>
              <Select
                value={recipientType}
                onValueChange={(v) => {
                  setRecipientType(v as RecipientType);
                  setSelectedEvent("");
                  setSingleSearch("");
                  setSelectedPerson(null);
                  setCoordinatorSearch("");
                  setSelectedCoordinator(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_contact">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Contato Individual
                    </div>
                  </SelectItem>
                  <SelectItem value="single_leader">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Líder Individual
                    </div>
                  </SelectItem>
                  <SelectItem value="contacts">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todos os Contatos
                    </div>
                  </SelectItem>
                  <SelectItem value="leaders">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Todas as Lideranças
                    </div>
                  </SelectItem>
                  <SelectItem value="event">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Inscritos em Evento
                    </div>
                  </SelectItem>
                  <SelectItem value="sms_not_sent">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      Líderes - SMS Não Enviado
                    </div>
                  </SelectItem>
                  <SelectItem value="waiting_verification">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Líderes - Aguardando Verificação
                    </div>
                  </SelectItem>
                  <SelectItem value="coordinator_tree">
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4" />
                      Árvore de Líder
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isSingleSend && (
              <div className="space-y-2">
                <Label>Buscar por Nome</Label>
                {selectedPerson ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <Badge variant="secondary" className="flex-1">
                      {selectedPerson.nome}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        setSelectedPerson(null);
                        setSingleSearch("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      placeholder="Digite pelo menos 2 caracteres..."
                      value={singleSearch}
                      onChange={(e) => setSingleSearch(e.target.value)}
                    />
                    {searchResults && searchResults.length > 0 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto">
                        {searchResults.map((person) => (
                          <button
                            key={person.id}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                            onClick={() => {
                              setSelectedPerson(person);
                              setSingleSearch("");
                            }}
                          >
                            <div className="font-medium">{person.nome}</div>
                            <div className="text-xs text-muted-foreground">{person.phone}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {singleSearch.length >= 2 && searchResults?.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
                    )}
                  </>
                )}
              </div>
            )}

            {recipientType === "coordinator_tree" && (
              <div className="space-y-2">
                <Label>Buscar Líder com Subordinados</Label>
                <Input
                  placeholder="Digite o nome do líder..."
                  value={coordinatorSearch}
                  onChange={(e) => {
                    setCoordinatorSearch(e.target.value);
                    setSelectedCoordinator(null);
                  }}
                />
                {/* Lista de resultados */}
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
                {coordinatorSearch.length >= 2 && coordinatorSearchResults?.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum líder com subordinados encontrado</p>
                )}
                {/* Coordenador selecionado */}
                {selectedCoordinator && (
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{selectedCoordinator.nome_completo}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          {selectedCoordinator.unverified_count} não verificados
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => {
                            setSelectedCoordinator(null);
                            setCoordinatorSearch("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedCoordinator.total_in_tree} líderes na árvore
                    </p>
                  </div>
                )}
              </div>
            )}

            {recipientType === "event" && (
              <div className="space-y-2">
                <Label>Evento</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um evento" />
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

            {!isSingleSend && (
              <div className="space-y-2">
                <Label>Tamanho do Lote</Label>
                <Select value={batchSize} onValueChange={(v) => setBatchSize(v as BatchSize)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BATCH_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Resumo do Envio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {loadingRecipients ? "..." : recipients?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Destinatários</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold">~{estimatedTime} min</div>
                <div className="text-sm text-muted-foreground">Tempo estimado</div>
              </div>
            </div>

            {selectedTemplateData && (
              <div className="space-y-2">
                <Label>Preview da Mensagem</Label>
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p>{selectedTemplateData.mensagem}</p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {selectedTemplateData.mensagem.length}/160 caracteres
                  </div>
                </div>
                {selectedTemplateData.variaveis?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTemplateData.variaveis.map((v) => (
                      <Badge key={v} variant="outline" className="text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(isSending || waitingForConfirmation) && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>
                    Lote {currentBatch} de {totalBatches}
                  </span>
                  <span>
                    {sentCount}/{totalCount} enviados
                  </span>
                </div>
                <Progress value={sendProgress} />
              </div>
            )}

            {duplicateInfo.count > 0 && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>{duplicateInfo.count.toLocaleString('pt-BR')}</strong> de {recipients?.length.toLocaleString('pt-BR')} destinatários ({duplicateInfo.percentage}%) já receberam esta mensagem nos últimos 7 dias.
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                O envio utiliza intervalos de 3-6 segundos entre mensagens para evitar bloqueios.
              </AlertDescription>
            </Alert>

            {waitingForConfirmation ? (
              <div className="flex gap-2">
                <Button onClick={handleContinue} className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Continuar Envio
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleSendBulk()}
                  disabled={
                    isSending ||
                    (!selectedTemplate && !isVerificationType) ||
                    !recipients?.length ||
                    (recipientType === "event" && !selectedEvent) ||
                    (isSingleSend && !selectedPerson) ||
                    (recipientType === "coordinator_tree" && !selectedCoordinator)
                  }
                >
                  {isSending ? (
                    <>Enviando...</>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isSingleSend ? "Enviar" : "Enviar Agora"}
                    </>
                  )}
                </Button>
                {!isSingleSend && !isVerificationType && (
                  <Button
                    variant="outline"
                    onClick={() => setShowScheduleDialog(true)}
                    disabled={
                      isSending ||
                      !selectedTemplate ||
                      !recipients?.length ||
                      (recipientType === "event" && !selectedEvent)
                    }
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Agendar
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ScheduleMessageDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onSchedule={async (scheduledFor) => {
          if (!recipients?.length || !selectedTemplate) return;
          
          const batchId = crypto.randomUUID();
          const messages = recipients.map((r) => ({
            message_type: "sms" as const,
            recipient_phone: r.phone,
            recipient_name: r.nome,
            template_slug: selectedTemplate,
            variables: {
              nome: r.nome || "",
              // SEMPRE usa URL de produção para links de afiliado
              ...(r.affiliate_token ? { link_indicacao: generateLeaderReferralUrl(r.affiliate_token) } : {}),
            },
            scheduled_for: scheduledFor.toISOString(),
            contact_id: recipientType === "contacts" || recipientType === "event" ? r.id : undefined,
            leader_id: recipientType === "leaders" ? r.id : undefined,
            batch_id: batchId,
          }));

          try {
            await createScheduledMessages.mutateAsync(messages);
            toast.success(`${messages.length} SMS agendados para ${format(scheduledFor, "dd/MM/yyyy 'às' HH:mm")}`);
            setShowScheduleDialog(false);
          } catch (error) {
            toast.error("Erro ao agendar mensagens");
          }
        }}
        onSendNow={() => {
          setShowScheduleDialog(false);
          handleSendBulk();
        }}
        recipientCount={recipients?.length || 0}
        messageType="sms"
        isLoading={createScheduledMessages.isPending}
      />
    </div>
  );
}
