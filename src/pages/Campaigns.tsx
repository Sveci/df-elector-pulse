import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { generateCampaignUrl, generateLeaderReferralUrl, generateEventCampaignUrl, generateFunnelCampaignUrl } from "@/lib/urlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";
import { useEvents } from "@/hooks/events/useEvents";
import { useAttributionStats } from "@/hooks/campaigns/useAttributionStats";
import { format } from "date-fns";
import CampaignReportDialog from "@/components/campaigns/CampaignReportDialog";
import LeaderReferralsDialog from "@/components/campaigns/LeaderReferralsDialog";
import { CaptacaoTab } from "@/components/campaigns/CaptacaoTab";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import JSZip from "jszip";
import {
  Target,
  Plus,
  ExternalLink,
  Copy,
  QrCode,
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  Eye,
  Edit,
  Share,
  Download,
  RefreshCw,
  MapPin,
  UserCheck,
  Megaphone,
  FileSpreadsheet,
  Building2,
  FileText,
  Loader2,
  FileArchive,
  Search,
  Link as LinkIcon
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import { useDemoMask } from "@/contexts/DemoModeContext";
import type { Step } from "react-joyride";

const campaignsTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="campaigns-header"]',
    title: "Campanhas de Atribuição",
    content: "Gerencie campanhas UTM para rastrear a origem dos cadastros. Crie links personalizados para eventos e funis.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="campaigns-tabs"]',
    title: "Abas de Campanhas",
    content: "Alterne entre campanhas UTM (para eventos) e a aba de Captação (funis de lead magnet).",
    placement: "bottom",
  },
  {
    target: '[data-tutorial="campaigns-create"]',
    title: "Criar Campanha",
    content: "Crie novas campanhas com parâmetros UTM para rastrear a origem dos cadastros.",
    placement: "left",
  },
];

// Função para normalizar strings (remover acentos e lowercase)
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const Campaigns = () => {
  const tenantDomain = useTenantDomain();
  const [newCampaign, setNewCampaign] = useState({
    targetType: "event" as "event" | "funnel",
    eventId: "",
    eventSlug: "",
    funnelId: "",
    funnelSlug: "",
    name: "",
    description: "",
    utmSource: "",
    utmMedium: "",
    utmCampaign: ""
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<{
    id: string;
    name: string;
    description: string;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
  } | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<{ utmCampaign: string; name: string } | null>(null);
  const [referralsDialogOpen, setReferralsDialogOpen] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState<{
    id: string;
    leaderName: string;
    cityName: string | null;
  } | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<'single' | 'all' | 'batch' | null>(null);
  const [generatingLeaderId, setGeneratingLeaderId] = useState<string | null>(null);

  // Estados para busca e paginação na aba Líderes
  const [leaderSearchTerm, setLeaderSearchTerm] = useState("");
  const [leaderCurrentPage, setLeaderCurrentPage] = useState(1);
  const leadersPerPage = 10;

  const { toast } = useToast();
  const { restartTutorial } = useTutorial("campaigns", campaignsTutorialSteps);
  const { isDemoMode, m } = useDemoMask();
  const queryClient = useQueryClient();

  const { data: events = [] } = useEvents();
  const activeEvents = events.filter(e => e.status === 'active');

  // Buscar funis de captação ativos
  const { data: activeFunnels = [] } = useQuery({
    queryKey: ['lead-funnels-for-campaign'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_funnels')
        .select('id, nome, slug')
        .eq('status', 'active')
        .order('nome');
      if (error) throw error;
      return data || [];
    }
  });

  // Buscar campanhas reais do banco
  const { data: campaigns = [], isLoading, refetch } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Para cada campanha, buscar métricas
      const campaignsWithMetrics = await Promise.all((data || []).map(async (campaign: any) => {
        let pageViews = 0;
        let registrations = 0;

        // Se é campanha de FUNIL, buscar dados direto do lead_funnels
        if (campaign.funnel_id) {
          const { data: funnelData } = await supabase
            .from('lead_funnels')
            .select('views_count, leads_count')
            .eq('id', campaign.funnel_id)
            .maybeSingle();

          if (funnelData) {
            pageViews = funnelData.views_count || 0;
            registrations = funnelData.leads_count || 0;
          }
        } else {
          // Para campanhas de EVENTO, buscar de page_views
          const { count: pageViewsCount } = await supabase
            .from('page_views')
            .select('*', { count: 'exact', head: true })
            .eq('utm_campaign', campaign.utm_campaign);

          pageViews = pageViewsCount || 0;
          registrations = campaign.total_cadastros;
        }

        const conversionRate = pageViews > 0 ? ((registrations / pageViews) * 100).toFixed(1) : "0.0";

        return {
          id: campaign.id,
          name: campaign.nome,
          description: campaign.descricao || '',
          utmSource: campaign.utm_source,
          utmMedium: campaign.utm_medium || '',
          utmCampaign: campaign.utm_campaign,
          eventSlug: campaign.event_slug,
          funnelSlug: campaign.funnel_slug,
          funnelId: campaign.funnel_id,
          link: campaign.funnel_slug
            ? generateFunnelCampaignUrl(
                campaign.funnel_slug,
                campaign.utm_source,
                campaign.utm_medium || 'direct',
                campaign.utm_campaign,
                tenantDomain
              )
            : campaign.event_slug
            ? generateEventCampaignUrl(
                campaign.event_slug,
                campaign.utm_source,
                campaign.utm_medium || 'direct',
                campaign.utm_campaign,
                tenantDomain
              )
            : generateCampaignUrl(
                campaign.utm_source,
                campaign.utm_medium || 'direct',
                campaign.utm_campaign,
                tenantDomain
              ),
          qrCode: `data:image/svg+xml;base64,${btoa(`<svg width="200" height="200"><rect width="200" height="200" fill="white"/><text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="14" fill="black">${campaign.utm_campaign}</text></svg>`)}`,
          createdAt: new Date(campaign.created_at).toISOString().split('T')[0],
          status: campaign.status,
          registrations,
          pageViews,
          conversionRate
        };
      }));

      return campaignsWithMetrics;
    },
    refetchOnWindowFocus: true,
    staleTime: 10000, // Atualiza mais frequentemente (10s)
    refetchInterval: 15000, // Atualização automática a cada 15 segundos
  });

  // Buscar líderes reais do banco - buscar TODOS (até 5000)
  const { data: leaderLinks = [], isLoading: isLoadingLeaders, isError: isLeadersError, error: leadersError } = useQuery({
    queryKey: ['leaders-with-links-v5'],
    queryFn: async () => {
      const startTime = Date.now();
      console.log('[DEBUG Query v5] ========================================');
      console.log('[DEBUG Query v5] Iniciando busca de líderes com batching...');
      console.log('[DEBUG Query v5] Timestamp:', new Date().toISOString());

      const allLeaders: any[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      // Loop para buscar todos os registros em chunks de 1000
      while (hasMore) {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        console.log(`[DEBUG Query v5] Buscando página ${page + 1} (registros ${from} a ${to})...`);

        const { data, error } = await supabase
          .from('lideres')
          .select('id, nome_completo, email, telefone, affiliate_token, cidade:office_cities(nome), cadastros, last_activity')
          .eq('is_active', true)
          .not('affiliate_token', 'is', null)
          .order('cadastros', { ascending: false })
          .order('id', { ascending: true }) // Ordenação secundária para paginação determinística
          .range(from, to);

        if (error) {
          console.error(`[DEBUG Query v5] ERRO na página ${page + 1}:`, error);
          throw error;
        }

        if (data && data.length > 0) {
          allLeaders.push(...data);
          console.log(`[DEBUG Query v5] Página ${page + 1}: ${data.length} registros (total acumulado: ${allLeaders.length})`);
          hasMore = data.length === pageSize;
          page++;
        } else {
          console.log(`[DEBUG Query v5] Página ${page + 1}: 0 registros - finalizando`);
          hasMore = false;
        }
      }

      console.log(`[DEBUG Query v5] Total de líderes carregados: ${allLeaders.length}`);
      console.log(`[DEBUG Query v5] Busca concluída em ${Date.now() - startTime}ms`);

      // Debug: verificar amostra de nomes
      console.log('[DEBUG Query v5] Amostra de nomes carregados:',
        allLeaders.slice(0, 10).map(l => l.nome_completo));

      // Debug: verificar se "Giselle de Andrade Garcia" está na lista
      const giselleTest = allLeaders.find(l =>
        l.nome_completo?.toLowerCase().includes('giselle de andrade garcia'));
      console.log('[DEBUG Query v5] Giselle de Andrade Garcia encontrada:', !!giselleTest, giselleTest?.id);

      console.log('[DEBUG Query v5] ========================================');

      return allLeaders.map(leader => ({
        id: leader.id,
        leaderName: leader.nome_completo,
        leaderEmail: leader.email || '',
        leaderPhone: leader.telefone || '',
        affiliateToken: leader.affiliate_token!,
        cityName: leader.cidade && typeof leader.cidade === 'object' && 'nome' in leader.cidade
          ? (leader.cidade as { nome: string }).nome
          : null,
        link: generateLeaderReferralUrl(leader.affiliate_token!, tenantDomain),
        registrations: leader.cadastros,
        lastActivity: leader.last_activity
      }));
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    retry: 3,
    retryDelay: 1000,
  });

  // Filtrar líderes por busca (nome, email, telefone)
  const filteredLeaderLinks = useMemo(() => {
    console.log(`[DEBUG Filter] isLoading: ${isLoadingLeaders}, isError: ${isLeadersError}`);
    if (isLeadersError) {
      console.error('[DEBUG Filter] Erro na query:', leadersError);
    }
    console.log(`[DEBUG Filter] Total líderes carregados: ${leaderLinks.length}`);
    console.log(`[DEBUG Filter] Termo de busca: "${leaderSearchTerm}"`);

    if (!leaderSearchTerm.trim()) return leaderLinks;

    const search = normalizeString(leaderSearchTerm.trim());
    const searchDigits = leaderSearchTerm.replace(/\D/g, "");

    console.log(`[DEBUG] Busca normalizada: "${search}"`);

    const filtered = leaderLinks.filter((leader) => {
      const normalizedName = normalizeString(leader.leaderName || "");

      // Busca normalizada (sem acentos)
      const matchesNormalized = normalizedName.includes(search);

      // Fallback: busca exata (lowercase apenas, preserva acentos)
      const matchesExact = (leader.leaderName || "").toLowerCase()
        .includes(leaderSearchTerm.trim().toLowerCase());

      const matchesEmail = (leader.leaderEmail || "").toLowerCase().includes(search);
      const matchesPhone = searchDigits.length >= 4 &&
        leader.leaderPhone?.replace(/\D/g, "").includes(searchDigits);

      return matchesNormalized || matchesExact || matchesEmail || matchesPhone;
    });

    console.log(`[DEBUG Filter] Resultados encontrados: ${filtered.length}`);
    return filtered;
  }, [leaderLinks, leaderSearchTerm, isLoadingLeaders, isLeadersError, leadersError]);

  // Handler para forçar recarga da lista de líderes
  const handleRefreshLeaders = () => {
    queryClient.invalidateQueries({ queryKey: ['leaders-with-links-v5'] });
    toast({
      title: "Atualizando lista...",
      description: "Recarregando dados dos líderes."
    });
  };

  // Paginação
  const totalLeaderPages = Math.ceil(filteredLeaderLinks.length / leadersPerPage);
  const paginatedLeaders = filteredLeaderLinks.slice(
    (leaderCurrentPage - 1) * leadersPerPage,
    leaderCurrentPage * leadersPerPage
  );

  // Resetar página ao mudar busca
  useEffect(() => {
    setLeaderCurrentPage(1);
  }, [leaderSearchTerm]);

  const handleCreateCampaign = async () => {
    // Validar campos baseado no tipo de destino
    if (newCampaign.targetType === 'event' && !newCampaign.eventId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o evento, fonte e campanha UTM.",
        variant: "destructive"
      });
      return;
    }

    if (newCampaign.targetType === 'funnel' && !newCampaign.funnelId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o funil de captação, fonte e campanha UTM.",
        variant: "destructive"
      });
      return;
    }

    if (!newCampaign.utmSource || !newCampaign.utmCampaign) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a fonte e campanha UTM.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('campaigns')
        .insert({
          event_id: newCampaign.targetType === 'event' ? newCampaign.eventId : null,
          event_slug: newCampaign.targetType === 'event' ? newCampaign.eventSlug : null,
          funnel_id: newCampaign.targetType === 'funnel' ? newCampaign.funnelId : null,
          funnel_slug: newCampaign.targetType === 'funnel' ? newCampaign.funnelSlug : null,
          nome: newCampaign.name,
          descricao: newCampaign.description,
          utm_source: newCampaign.utmSource,
          utm_medium: newCampaign.utmMedium || null,
          utm_campaign: newCampaign.utmCampaign,
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Campanha criada!",
        description: "A campanha foi criada com sucesso."
      });

      setNewCampaign({ targetType: "event", eventId: "", eventSlug: "", funnelId: "", funnelSlug: "", name: "", description: "", utmSource: "", utmMedium: "", utmCampaign: "" });
      setIsCreateDialogOpen(false);
      refetch();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a campanha.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateCampaign = async () => {
    if (!editingCampaign) return;

    if (!editingCampaign.name || !editingCampaign.utmSource || !editingCampaign.utmCampaign) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome, fonte e campanha UTM são obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({
          nome: editingCampaign.name,
          descricao: editingCampaign.description,
          utm_source: editingCampaign.utmSource,
          utm_medium: editingCampaign.utmMedium || null,
          utm_campaign: editingCampaign.utmCampaign
        })
        .eq('id', editingCampaign.id);

      if (error) throw error;

      toast({
        title: "Campanha atualizada!",
        description: "As alterações foram salvas com sucesso."
      });

      setIsEditDialogOpen(false);
      setEditingCampaign(null);
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar campanha:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a campanha.",
        variant: "destructive"
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Link copiado para a área de transferência."
    });
  };

  const downloadQRCode = (qrCode: string, filename: string) => {
    const link = document.createElement('a');
    link.download = `${filename}.svg`;
    link.href = qrCode;
    link.click();

    toast({
      title: "QR Code baixado!",
      description: "Arquivo salvo como SVG."
    });
  };

  // Função para gerar PDF de um único líder
  const generateSingleLeaderPdf = async (leader: typeof leaderLinks[0]) => {
    setGeneratingPdf('single');
    setGeneratingLeaderId(leader.id);

    try {
      const pdf = new jsPDF();
      const qrDataUrl = await QRCode.toDataURL(leader.link, { width: 400, margin: 1 });

      // Header
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Link de Cadastro", 105, 30, { align: "center" });

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "normal");
      pdf.text(leader.leaderName, 105, 45, { align: "center" });

      if (leader.cityName) {
        pdf.setFontSize(12);
        pdf.setTextColor(100);
        pdf.text(leader.cityName, 105, 55, { align: "center" });
      }

      // QR Code
      pdf.addImage(qrDataUrl, "PNG", 55, 70, 100, 100);

      // Link clicável
      pdf.setFontSize(10);
      pdf.setTextColor(0, 102, 204);
      pdf.textWithLink(leader.link, 105, 185, { align: "center", url: leader.link });

      // Instruções
      pdf.setFontSize(11);
      pdf.setTextColor(80);
      pdf.text("Escaneie o QR Code ou acesse o link acima para se cadastrar", 105, 200, { align: "center" });

      // Rodapé
      pdf.setFontSize(9);
      pdf.setTextColor(150);
      pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 280, { align: "center" });

      pdf.save(`link-cadastro-${leader.leaderName.toLowerCase().replace(/\s+/g, '-')}.pdf`);

      toast({
        title: "PDF gerado!",
        description: `PDF de ${leader.leaderName} baixado com sucesso.`
      });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF.",
        variant: "destructive"
      });
    } finally {
      setGeneratingPdf(null);
      setGeneratingLeaderId(null);
    }
  };

  // Função para gerar PDF consolidado com todos os líderes
  const generateAllLeadersPdf = async () => {
    if (leaderLinks.length === 0) return;

    setGeneratingPdf('all');

    try {
      const pdf = new jsPDF();

      // Capa
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Links de Cadastro", 105, 60, { align: "center" });

      pdf.setFontSize(16);
      pdf.setFont("helvetica", "normal");
      pdf.text("Lideranças", 105, 75, { align: "center" });

      pdf.setFontSize(12);
      pdf.setTextColor(100);
      pdf.text(`${leaderLinks.length} líderes`, 105, 90, { align: "center" });
      pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 100, { align: "center" });

      // Líderes
      const leadersPerPage = 3;
      for (let i = 0; i < leaderLinks.length; i++) {
        const leader = leaderLinks[i];
        const positionOnPage = i % leadersPerPage;

        if (i > 0 && positionOnPage === 0) {
          pdf.addPage();
        }

        if (i === 0 || positionOnPage === 0) {
          if (i > 0) {
            // Header em cada página
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text("Links de Cadastro - Lideranças", 20, 15);
          }
        }

        const yOffset = i === 0 ? 140 : 30 + (positionOnPage * 85);

        // QR Code
        const qrDataUrl = await QRCode.toDataURL(leader.link, { width: 200, margin: 1 });
        pdf.addImage(qrDataUrl, "PNG", 20, yOffset, 50, 50);

        // Info do líder
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0);
        pdf.text(leader.leaderName, 80, yOffset + 15);

        if (leader.cityName) {
          pdf.setFontSize(11);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100);
          pdf.text(leader.cityName, 80, yOffset + 25);
        }

        // Link clicável
        pdf.setFontSize(9);
        pdf.setTextColor(0, 102, 204);
        pdf.textWithLink(leader.link, 80, yOffset + 40, { url: leader.link });

        // Linha separadora
        if (positionOnPage < leadersPerPage - 1 && i < leaderLinks.length - 1) {
          pdf.setDrawColor(200);
          pdf.line(20, yOffset + 75, 190, yOffset + 75);
        }

        // Número da página
        pdf.setFontSize(9);
        pdf.setTextColor(150);
        const pageNumber = Math.floor(i / leadersPerPage) + 1;
        const totalPages = Math.ceil(leaderLinks.length / leadersPerPage) + 1; // +1 para capa
        pdf.text(`Página ${pageNumber + 1} de ${totalPages}`, 105, 285, { align: "center" });
      }

      pdf.save(`links-lideres-consolidado-${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "PDF consolidado gerado!",
        description: `PDF com ${leaderLinks.length} líderes baixado com sucesso.`
      });
    } catch (error) {
      console.error("Erro ao gerar PDF consolidado:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar o PDF consolidado.",
        variant: "destructive"
      });
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Função para gerar PDFs individuais em lote (ZIP)
  const generateBatchPdfs = async () => {
    if (leaderLinks.length === 0) return;

    setGeneratingPdf('batch');

    try {
      const zip = new JSZip();

      for (const leader of leaderLinks) {
        const pdf = new jsPDF();
        const qrDataUrl = await QRCode.toDataURL(leader.link, { width: 400, margin: 1 });

        // Header
        pdf.setFontSize(20);
        pdf.setFont("helvetica", "bold");
        pdf.text("Link de Cadastro", 105, 30, { align: "center" });

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "normal");
        pdf.text(leader.leaderName, 105, 45, { align: "center" });

        if (leader.cityName) {
          pdf.setFontSize(12);
          pdf.setTextColor(100);
          pdf.text(leader.cityName, 105, 55, { align: "center" });
        }

        // QR Code
        pdf.addImage(qrDataUrl, "PNG", 55, 70, 100, 100);

        // Link clicável
        pdf.setFontSize(10);
        pdf.setTextColor(0, 102, 204);
        pdf.textWithLink(leader.link, 105, 185, { align: "center", url: leader.link });

        // Instruções
        pdf.setFontSize(11);
        pdf.setTextColor(80);
        pdf.text("Escaneie o QR Code ou acesse o link acima para se cadastrar", 105, 200, { align: "center" });

        // Rodapé
        pdf.setFontSize(9);
        pdf.setTextColor(150);
        pdf.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 105, 280, { align: "center" });

        // Adicionar ao ZIP
        const pdfBlob = pdf.output('blob');
        const fileName = `link-cadastro-${leader.leaderName.toLowerCase().replace(/\s+/g, '-')}.pdf`;
        zip.file(fileName, pdfBlob);
      }

      // Gerar e baixar o ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `links-lideres-individuais-${format(new Date(), "yyyy-MM-dd")}.zip`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "ZIP gerado!",
        description: `${leaderLinks.length} PDFs individuais compactados e baixados.`
      });
    } catch (error) {
      console.error("Erro ao gerar PDFs em lote:", error);
      toast({
        title: "Erro",
        description: "Não foi possível gerar os PDFs em lote.",
        variant: "destructive"
      });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const toggleCampaignStatus = async (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) return;

    const newStatus = campaign.status === 'active' ? 'paused' : 'active';

    try {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaignId);

      if (error) throw error;

      refetch(); // Recarregar campanhas
      toast({
        title: "Status atualizado!",
        description: `Campanha ${newStatus === 'active' ? 'ativada' : 'pausada'} com sucesso.`
      });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <TutorialOverlay page="campaigns" />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8" data-tutorial="campaigns-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <PageHeader
              icon={Megaphone}
              title="Campanhas & Atribuição"
              subtitle="Geração de links, QR Codes e relatórios de origem dos cadastros"
            />
            <div className="flex gap-2">
              <TutorialButton onClick={restartTutorial} />
              <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-tutorial="campaigns-create">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Campanha
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Nova Campanha</DialogTitle>
                </DialogHeader>
                <CreateCampaignForm
                  newCampaign={newCampaign}
                  setNewCampaign={setNewCampaign}
                  onSubmit={handleCreateCampaign}
                  activeEvents={activeEvents}
                  activeFunnels={activeFunnels}
                />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <Tabs defaultValue="campaigns" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4" data-tutorial="campaigns-tabs">
            <TabsTrigger value="campaigns">Campanhas UTM</TabsTrigger>
            <TabsTrigger value="captacao">Captação</TabsTrigger>
            <TabsTrigger value="leaders">Links de Líderes</TabsTrigger>
            <TabsTrigger value="attribution">Relatório de Origens</TabsTrigger>
          </TabsList>

          {/* Captação */}
          <TabsContent value="captacao">
            <CaptacaoTab />
          </TabsContent>

          {/* Campanhas UTM */}
          <TabsContent value="campaigns">
            <div className="grid gap-6">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="card-default">
                  <CardContent className="p-6">
                    <div className="grid md:grid-cols-12 gap-4">
                      {/* Info da Campanha */}
                      <div className="md:col-span-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {isDemoMode ? m.name(campaign.name) : campaign.name}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {isDemoMode ? m.observation(campaign.description) : campaign.description}
                            </p>
                            <div className="flex items-center space-x-2">
                              <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
                                {campaign.status === "active" ? "Ativa" : "Pausada"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {campaign.utmSource}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCampaignStatus(campaign.id)}
                          >
                            {campaign.status === "active" ? "Pausar" : "Ativar"}
                          </Button>
                        </div>
                      </div>

                      {/* Métricas */}
                      <div className="md:col-span-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <p className="text-sm text-gray-600">Visitantes</p>
                            <p className="font-bold text-purple-600">{m.number(campaign.pageViews, campaign.name + "_views")}</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600">Cadastros</p>
                            <p className="font-bold text-blue-600">{m.number(campaign.registrations, campaign.name + "_regs")}</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-600">Conversão</p>
                            <p className="font-bold text-green-600">{isDemoMode ? m.percentage(parseFloat(campaign.conversionRate), campaign.name + "_conv") : campaign.conversionRate}%</p>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-2">
                          Criada em {new Date(campaign.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Link e QR Code */}
                      <div className="md:col-span-4">
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Input
                              value={campaign.link}
                              readOnly
                              className="text-xs"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(campaign.link)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(campaign.link, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadQRCode(campaign.qrCode, campaign.utmCampaign)}
                              className="flex-1"
                            >
                              <QrCode className="h-4 w-4 mr-2" />
                              Baixar QR
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedCampaign({
                                  utmCampaign: campaign.utmCampaign,
                                  name: campaign.name
                                });
                                setReportDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCampaign({
                                  id: campaign.id,
                                  name: campaign.name,
                                  description: campaign.description,
                                  utmSource: campaign.utmSource,
                                  utmMedium: campaign.utmMedium,
                                  utmCampaign: campaign.utmCampaign
                                });
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Links de Líderes */}
          <TabsContent value="leaders">
            {/* Campo de Busca */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou telefone..."
                  value={leaderSearchTerm}
                  onChange={(e) => setLeaderSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {filteredLeaderLinks.length} líderes encontrados
                {leaderSearchTerm && ` para "${leaderSearchTerm}"`}
                {" "}(Total: {leaderLinks.length})
              </p>
            </div>

            {/* Barra de ações para geração de PDFs */}
            {filteredLeaderLinks.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshLeaders}
                  disabled={isLoadingLeaders}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingLeaders ? 'animate-spin' : ''}`} />
                  Atualizar Lista
                </Button>

                <Button
                  variant="outline"
                  onClick={generateAllLeadersPdf}
                  disabled={generatingPdf !== null}
                >
                  {generatingPdf === 'all' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  PDF Consolidado ({filteredLeaderLinks.length})
                </Button>

                <Button
                  variant="outline"
                  onClick={generateBatchPdfs}
                  disabled={generatingPdf !== null}
                >
                  {generatingPdf === 'batch' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileArchive className="h-4 w-4 mr-2" />
                  )}
                  PDFs Individuais (ZIP)
                </Button>
              </div>
            )}

            <div className="grid gap-6">
              {paginatedLeaders.length === 0 ? (
                <Card className="card-default">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    {leaderSearchTerm
                      ? "Nenhum líder encontrado para esta busca."
                      : "Nenhum líder com token de afiliado encontrado."
                    }
                  </CardContent>
                </Card>
              ) : (
                paginatedLeaders.map((leader) => (
                  <Card key={leader.id} className="card-default">
                    <CardContent className="p-6">
                      <div className="grid md:grid-cols-12 gap-4 items-center">
                        {/* Info do Líder */}
                        <div className="md:col-span-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center font-bold">
                              {(isDemoMode ? m.name(leader.leaderName) : leader.leaderName).split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {isDemoMode ? m.name(leader.leaderName) : leader.leaderName}
                              </h3>
                              {leader.cityName && (
                                <p className="text-sm text-gray-600">
                                  {isDemoMode ? m.city(leader.cityName) : leader.cityName}
                                </p>
                              )}
                              {leader.leaderPhone && (
                                <p className="text-xs text-gray-500">
                                  {isDemoMode ? m.phone(leader.leaderPhone) : leader.leaderPhone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Métricas */}
                        <div className="md:col-span-3">
                          <button
                            onClick={() => {
                              setSelectedLeader({
                                id: leader.id,
                                leaderName: leader.leaderName,
                                cityName: leader.cityName,
                              });
                              setReferralsDialogOpen(true);
                            }}
                            className="w-full text-center p-3 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors cursor-pointer"
                          >
                            <p className="text-sm text-gray-600">Indicações</p>
                            <p className="font-bold text-primary-600">{m.number(leader.registrations, leader.leaderName)}</p>
                          </button>
                          {leader.lastActivity && (
                            <p className="text-xs text-gray-500 text-center mt-2">
                              Última atividade: {new Date(leader.lastActivity).toLocaleDateString()}
                            </p>
                          )}
                        </div>

                        {/* Link e Ações */}
                        <div className="md:col-span-5">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <Input
                                value={leader.link}
                                readOnly
                                className="text-xs"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(leader.link)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(leader.link, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="flex space-x-2">
                              {leader.leaderPhone && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const whatsappText = `Olá! Use este link para se cadastrar: ${leader.link}`;
                                    const whatsappUrl = `https://wa.me/55${leader.leaderPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappText)}`;
                                    window.open(whatsappUrl, '_blank');
                                  }}
                                  className="flex-1"
                                >
                                  <Share className="h-4 w-4 mr-2" />
                                  Compartilhar
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateSingleLeaderPdf(leader)}
                                disabled={generatingPdf !== null}
                                title="Gerar PDF com QR Code"
                              >
                                {generatingPdf === 'single' && generatingLeaderId === leader.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <QrCode className="h-4 w-4 mr-1" />
                                    PDF
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Paginação */}
            {totalLeaderPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Mostrando {(leaderCurrentPage - 1) * leadersPerPage + 1} a{" "}
                  {Math.min(leaderCurrentPage * leadersPerPage, filteredLeaderLinks.length)} de{" "}
                  {filteredLeaderLinks.length} líderes
                </p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaderCurrentPage(p => Math.max(1, p - 1))}
                    disabled={leaderCurrentPage === 1}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm">
                    Página {leaderCurrentPage} de {totalLeaderPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaderCurrentPage(p => Math.min(totalLeaderPages, p + 1))}
                    disabled={leaderCurrentPage === totalLeaderPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Relatório de Origens */}
          <TabsContent value="attribution">
            <AttributionReport />
          </TabsContent>
        </Tabs>

        {/* Modal de Relatório */}
        {selectedCampaign && (
          <CampaignReportDialog
            open={reportDialogOpen}
            onOpenChange={setReportDialogOpen}
            campaignUtmCampaign={selectedCampaign.utmCampaign}
            campaignName={selectedCampaign.name}
          />
        )}

        {/* Modal de Indicações do Líder */}
        <LeaderReferralsDialog
          open={referralsDialogOpen}
          onOpenChange={setReferralsDialogOpen}
          leader={selectedLeader}
        />

        {/* Modal de Edição de Campanha */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Campanha</DialogTitle>
            </DialogHeader>
            {editingCampaign && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="editName">Nome da Campanha *</Label>
                  <Input
                    id="editName"
                    value={editingCampaign.name}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                    placeholder="Nome da campanha"
                  />
                </div>

                <div>
                  <Label htmlFor="editUtmSource">UTM Source *</Label>
                  <Select
                    value={editingCampaign.utmSource}
                    onValueChange={(value) => setEditingCampaign({ ...editingCampaign, utmSource: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a fonte" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="editUtmMedium">UTM Medium</Label>
                    <Select
                      value={editingCampaign.utmMedium}
                      onValueChange={(value) => setEditingCampaign({ ...editingCampaign, utmMedium: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o meio" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="stories">Stories</SelectItem>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="ad">Anúncio</SelectItem>
                        <SelectItem value="email">E-mail</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="print">Material Impresso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="editUtmCampaign">UTM Campaign *</Label>
                    <Input
                      id="editUtmCampaign"
                      value={editingCampaign.utmCampaign}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, utmCampaign: e.target.value })}
                      placeholder="Ex: educacao_jan24"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="editDescription">Descrição</Label>
                  <Textarea
                    id="editDescription"
                    value={editingCampaign.description}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })}
                    placeholder="Descreva o objetivo desta campanha..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateCampaign}>
                    Salvar Alterações
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

// Componente para o relatório de atribuição com dados reais
const AttributionReport = () => {
  const { isDemoMode, m } = useDemoMask();
  const { data: stats, isLoading, refetch } = useAttributionStats();

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'leader': return <UserCheck className="h-4 w-4" />;
      case 'leader_registration': return <Users className="h-4 w-4" />;
      case 'event': return <Calendar className="h-4 w-4" />;
      case 'campaign': return <Megaphone className="h-4 w-4" />;
      case 'manual': return <FileSpreadsheet className="h-4 w-4" />;
      case 'visit': return <Building2 className="h-4 w-4" />;
      case 'funnel': return <Target className="h-4 w-4" />;
      case 'webhook': return <LinkIcon className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-12 text-muted-foreground">
        Não foi possível carregar os dados de atribuição.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo Geral - Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-primary-600" />
            </div>
            <p className="text-2xl font-bold text-primary-600">{m.number(stats.summary.grandTotal ?? stats.summary.totalContacts ?? 0, "attr_total").toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Cadastros</p>
            {(stats.summary.totalLeaders ?? 0) > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                ({m.number(stats.summary.totalContacts ?? 0, "attr_contacts").toLocaleString()} contatos + {m.number(stats.summary.totalLeaders ?? 0, "attr_leaders").toLocaleString()} líderes)
              </p>
            )}
            {stats.growthPercentage !== 0 && (
              <p className={`text-xs flex items-center justify-center mt-1 ${stats.growthPercentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.growthPercentage > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {stats.growthPercentage > 0 ? '+' : ''}{stats.growthPercentage}% este mês
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{m.number(stats.summary.fromLeaders, "attr_from_leaders")}</p>
            <p className="text-xs text-muted-foreground">Via Líderes</p>
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{m.number(stats.summary.totalEventRegistrations, "attr_events")}</p>
            <p className="text-xs text-muted-foreground">Eventos</p>
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-5 w-5 text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-teal-600">{m.number(stats.summary.fromCaptacao, "attr_captacao")}</p>
            <p className="text-xs text-muted-foreground">Via Captação</p>
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Building2 className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{m.number(stats.summary.fromVisita, "attr_visita")}</p>
            <p className="text-xs text-muted-foreground">Via Visitas</p>
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Building2 className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{m.number(stats.summary.totalOfficeVisits, "attr_office")}</p>
            <p className="text-xs text-muted-foreground">Total Visitas</p>
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{m.number(stats.summary.activeLeaders, "attr_active_leaders")}</p>
            <p className="text-xs text-muted-foreground">Líderes Ativos</p>
          </CardContent>
        </Card>

        <Card className="card-default">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Megaphone className="h-5 w-5 text-pink-600" />
            </div>
            <p className="text-2xl font-bold text-pink-600">{stats.summary.activeCampaigns}</p>
            <p className="text-xs text-muted-foreground">Campanhas Ativas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <Card className="card-default">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <TrendingUp className="h-5 w-5 text-primary-600 mr-2" />
              Evolução de Cadastros (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthLabel" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    name="Cadastros"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Distribuição por Fonte */}
        <Card className="card-default">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <Target className="h-5 w-5 text-primary-600 mr-2" />
              Distribuição por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.sourceBreakdown.length > 0 ? (
              <div className="h-64 flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.sourceBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="count"
                      nameKey="source"
                    >
                      {stats.sourceBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {stats.sourceBreakdown.map((item, index) => (
                    <div key={item.source} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.source}</span>
                      </div>
                      <span className="font-medium">{m.number(item.count, item.source)} ({item.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhuma fonte de atribuição identificada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top Líderes por Captação */}
        <Card className="card-default">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <UserCheck className="h-5 w-5 text-primary-600 mr-2" />
              Top Líderes por Captação
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (Contatos + Eventos + Visitas)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topLeaders.length > 0 ? (
              <div className="space-y-3">
                {stats.topLeaders.map((leader, index) => (
                  <div key={leader.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{isDemoMode ? m.name(leader.name) : leader.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {leader.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {isDemoMode ? m.city(leader.city) : leader.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary text-lg">{m.number(leader.totalInfluence, leader.name)}</p>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap justify-end">
                        {leader.contactsReferred > 0 && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            👥 {m.number(leader.contactsReferred, leader.name + "_c")} contatos
                          </Badge>
                        )}
                        {leader.eventRegistrations > 0 && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            🎫 {m.number(leader.eventRegistrations, leader.name + "_e")} eventos
                          </Badge>
                        )}
                        {leader.officeVisits > 0 && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5">
                            🏢 {m.number(leader.officeVisits, leader.name + "_v")} visitas
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum líder com captações registradas
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Cidades */}
        <Card className="card-default">
          <CardHeader>
            <CardTitle className="flex items-center text-base">
              <MapPin className="h-5 w-5 text-primary-600 mr-2" />
              Distribuição por Cidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.cityDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.cityDistribution.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis
                      dataKey="city"
                      type="category"
                      width={100}
                      className="text-xs"
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Contatos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Nenhum dado de cidade disponível
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela detalhada de origens */}
      <Card className="card-default">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center text-base">
              <BarChart3 className="h-5 w-5 text-primary-600 mr-2" />
              Detalhamento por Origem
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.sourceBreakdown.length > 0 ? (
            <div className="space-y-3">
              {stats.sourceBreakdown.map((item, index) => (
                <div key={item.source} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                      {getSourceIcon(item.sourceType)}
                    </div>
                    <div>
                      <h4 className="font-medium">{item.source}</h4>
                      <p className="text-sm text-muted-foreground">{item.details}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary">{m.number(item.count, item.source).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{item.percentage}% do total</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma origem identificada.</p>
              <p className="text-sm mt-2">
                Os cadastros serão categorizados quando houver líderes, campanhas ou eventos ativos.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Componente para criar nova campanha
const CreateCampaignForm = ({
  newCampaign,
  setNewCampaign,
  onSubmit,
  activeEvents,
  activeFunnels
}: {
  newCampaign: any;
  setNewCampaign: (campaign: any) => void;
  onSubmit: () => void;
  activeEvents: any[];
  activeFunnels: any[];
}) => {
  return (
    <div className="space-y-4">
      {/* Seletor de tipo de destino */}
      <div>
        <Label htmlFor="targetType">Tipo de Destino *</Label>
        <Select
          value={newCampaign.targetType}
          onValueChange={(value: "event" | "funnel") => setNewCampaign({
            ...newCampaign,
            targetType: value,
            eventId: "",
            eventSlug: "",
            funnelId: "",
            funnelSlug: "",
            name: ""
          })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="event">Evento</SelectItem>
            <SelectItem value="funnel">Funil de Captação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Seletor de Evento ou Funil baseado no tipo */}
        <div>
          {newCampaign.targetType === 'event' ? (
            <>
              <Label htmlFor="event">Evento *</Label>
              <Select
                value={newCampaign.eventId}
                onValueChange={(eventId) => {
                  const event = activeEvents.find(e => e.id === eventId);
                  setNewCampaign({
                    ...newCampaign,
                    eventId,
                    eventSlug: event?.slug || '',
                    name: event?.name || ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um evento" />
                </SelectTrigger>
                <SelectContent>
                  {activeEvents.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum evento ativo disponível</SelectItem>
                  ) : (
                    activeEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} - {format(new Date(event.date + "T00:00:00"), 'dd/MM/yyyy')}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </>
          ) : (
            <>
              <Label htmlFor="funnel">Funil de Captação *</Label>
              <Select
                value={newCampaign.funnelId}
                onValueChange={(funnelId) => {
                  const funnel = activeFunnels.find(f => f.id === funnelId);
                  setNewCampaign({
                    ...newCampaign,
                    funnelId,
                    funnelSlug: funnel?.slug || '',
                    name: funnel?.nome || ''
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funil" />
                </SelectTrigger>
                <SelectContent>
                  {activeFunnels.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum funil ativo disponível</SelectItem>
                  ) : (
                    activeFunnels.map((funnel) => (
                      <SelectItem key={funnel.id} value={funnel.id}>
                        {funnel.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        <div>
          <Label htmlFor="utmSource">UTM Source *</Label>
          <Select
            value={newCampaign.utmSource}
            onValueChange={(value) => setNewCampaign({ ...newCampaign, utmSource: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a fonte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="utmMedium">UTM Medium</Label>
          <Select
            value={newCampaign.utmMedium}
            onValueChange={(value) => setNewCampaign({ ...newCampaign, utmMedium: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o meio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="stories">Stories</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="ad">Anúncio</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="print">Material Impresso</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="utmCampaign">UTM Campaign *</Label>
          <Input
            id="utmCampaign"
            value={newCampaign.utmCampaign}
            onChange={(e) => setNewCampaign({ ...newCampaign, utmCampaign: e.target.value })}
            placeholder="Ex: educacao_jan24"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={newCampaign.description}
          onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
          placeholder="Descreva o objetivo desta campanha..."
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button variant="outline" onClick={() => setNewCampaign({ targetType: "event", eventId: "", eventSlug: "", funnelId: "", funnelSlug: "", name: "", description: "", utmSource: "", utmMedium: "", utmCampaign: "" })}>
          Limpar
        </Button>
        <Button onClick={onSubmit}>
          Criar Campanha
        </Button>
      </div>
    </div>
  );
};

export default Campaigns;