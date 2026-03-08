import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import {
  Users,
  Search,
  Trophy,
  Pencil,
  Phone,
  Loader2,
  MapPin,
  Copy,
  CheckCircle,
  Download,
  QrCode,
  Mail,
  Star,
  Eye,
  Crown,
  Cake,
  Bell,
  Smartphone,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import QRCode from "qrcode";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLeaders } from "@/services/office/officeService";
import { useOfficeCities } from "@/hooks/office/useOfficeCities";
import { useLeaderLevels, getLeaderCardColorClass } from "@/hooks/leaders/useLeaderLevels";
import { useLeadersSubordinatesCounts } from "@/hooks/leaders/useLeaderSubordinates";
import { AddLeaderDialog } from "@/components/leaders/AddLeaderDialog";
import { EditLeaderDialog } from "@/components/leaders/EditLeaderDialog";
import { ImportLeadersDialog } from "@/components/leaders/ImportLeadersDialog";
import { LeaderRegistrationQRDialog } from "@/components/leaders/LeaderRegistrationQRDialog";
import { LeaderDetailsDialog } from "@/components/leaders/LeaderDetailsDialog";
import { LeaderLevelBadge, LeaderLevelProgress } from "@/components/leaders/LeaderLevelBadge";
import { SendPassNotificationDialog } from "@/components/leaders/SendPassNotificationDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { OfficeLeader } from "@/types/office";
import { generateAffiliateUrl } from "@/lib/urlHelper";
import { useTenantDomain } from "@/hooks/useTenantDomain";
import { format } from "date-fns";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";
import { useDemoMask } from "@/contexts/DemoModeContext";
import { getDemoLeadersPaginated, DEMO_LEADERS_STATS } from "@/data/leaders/demoLeaders";

const leadersTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="leaders-header"]',
    title: '👥 Gestão de Lideranças',
    content: 'Nesta página você gerencia todos os líderes cadastrados no sistema. Visualize estatísticas, filtre, adicione e gerencie cada líder.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="leaders-stats"]',
    title: '📊 Estatísticas Gerais',
    content: 'Veja o total de líderes, quantos estão ativos e a soma de pontos de toda a rede de lideranças.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-ranking-btn"]',
    title: '🏆 Ver Ranking',
    content: 'Acesse o ranking completo de líderes ordenado por pontuação e indicações.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-push-btn"]',
    title: '🔔 Notificação Push',
    content: 'Envie notificações push em massa para todos os líderes verificados que possuem o cartão digital instalado.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-import-btn"]',
    title: '📥 Importar Líderes',
    content: 'Importe líderes em massa através de uma planilha Excel ou CSV.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-form-btn"]',
    title: '📝 Formulário Público',
    content: 'Gere um QR Code e link para um formulário público onde novos líderes podem se cadastrar.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-add-btn"]',
    title: '➕ Adicionar Líder',
    content: 'Cadastre manualmente um novo líder no sistema com todos os dados necessários.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-filters"]',
    title: '🔍 Filtros de Busca',
    content: 'Use os filtros para encontrar líderes específicos por nome, região, status de verificação ou ordenação.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="leaders-list"]',
    title: '📋 Lista de Líderes',
    content: 'Cada card mostra informações do líder: nível, pontos, indicações, badges e ações disponíveis como editar, ver detalhes ou enviar WhatsApp.',
    placement: 'top',
  },
];

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

const getAvatarGradient = (name: string) => {
  const colors = [
    "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700",
    "bg-gradient-to-br from-green-100 to-green-200 text-green-700",
    "bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700",
    "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-700",
    "bg-gradient-to-br from-rose-100 to-rose-200 text-rose-700",
    "bg-gradient-to-br from-cyan-100 to-cyan-200 text-cyan-700",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 13) {
    return `(${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
  }
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

const getHierarchyBadge = (leader: OfficeLeader) => {
  if (leader.is_coordinator) {
    return { label: "Coordenador", className: "bg-amber-100 text-amber-700 border-amber-300" };
  }
  if (leader.hierarchy_level && leader.hierarchy_level > 1) {
    const level = leader.hierarchy_level - 1; // hierarchy_level 2 = Nível 1
    const colors: Record<number, string> = {
      1: "bg-blue-100 text-blue-700 border-blue-300",
      2: "bg-green-100 text-green-700 border-green-300",
      3: "bg-purple-100 text-purple-700 border-purple-300",
    };
    return { label: `Nível ${level}`, className: colors[level] || "bg-muted text-muted-foreground" };
  }
  return null;
};

const getBirthdayBadge = (leader: OfficeLeader) => {
  if (leader.days_until_birthday === undefined || leader.days_until_birthday === null) return null;

  const days = leader.days_until_birthday;

  if (days === 0) {
    return { label: "🎂 Hoje!", className: "bg-pink-100 text-pink-700 border-pink-300 animate-pulse" };
  } else if (days === 1) {
    return { label: "🎂 Amanhã!", className: "bg-pink-100 text-pink-700 border-pink-300" };
  } else if (days <= 7) {
    return { label: `🎂 Em ${days} dias`, className: "bg-amber-100 text-amber-700 border-amber-300" };
  } else if (days <= 30) {
    return { label: `🎂 Em ${days} dias`, className: "bg-blue-50 text-blue-600 border-blue-200" };
  }
  return null;
};

const ITEMS_PER_PAGE = 10;

const Leaders = () => {
  const tenantDomain = useTenantDomain();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [sortBy, setSortBy] = useState("cadastros_desc");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryClient = useQueryClient();
  const { isDemoMode, m } = useDemoMask();
  const { data: cities } = useOfficeCities();
  const { data: leaderLevels } = useLeaderLevels();
  const { data: leadersResult, isLoading } = useQuery({
    queryKey: ["leaders", selectedRegion, searchTerm, statusFilter, verificationFilter, sortBy, currentPage],
    queryFn: () =>
      getLeaders({
        cidade_id: selectedRegion === "all" ? undefined : selectedRegion,
        search: searchTerm || undefined,
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        sortBy,
        verificationFilter: verificationFilter as "all" | "verified" | "not_verified",
      }),
  });

  // Demo mode override
  const demoResult = isDemoMode
    ? getDemoLeadersPaginated({
        page: currentPage,
        pageSize: ITEMS_PER_PAGE,
        search: searchTerm || undefined,
        cidade_id: selectedRegion === "all" ? undefined : selectedRegion,
        sortBy,
        verificationFilter,
        statusFilter,
      })
    : null;

  const leaders = isDemoMode ? (demoResult?.data || []) : (leadersResult?.data || []);
  const totalCount = isDemoMode ? (demoResult?.count || 0) : (leadersResult?.count || 0);
  const effectiveIsLoading = isDemoMode ? false : isLoading;

  // Realtime subscription para atualizar automaticamente quando líder mudar (ex: cartão instalado/desinstalado)
  useEffect(() => {
    const channel = supabase
      .channel("leaders-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lideres",
        },
        (payload) => {
          console.log("Líder atualizado via realtime:", payload);
          // Invalida a query para refetch automático
          queryClient.invalidateQueries({ queryKey: ["leaders"] });
          setLastUpdated(new Date());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Buscar contagem de subordinados diretos para cada líder
  const leaderIds = leaders?.map((l) => l.id) || [];
  const { data: subordinatesCounts } = useLeadersSubordinatesCounts(leaderIds);

  // Buscar contagem de líderes verificados para notificações em massa
  const { data: verifiedLeadersCount } = useQuery({
    queryKey: ["verified_leaders_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lideres")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_verified", true);

      if (error) throw error;
      return count || 0;
    },
  });

  // Função de refresh manual
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["leaders"] });
    setLastUpdated(new Date());
    setIsRefreshing(false);
  };

  // Função para buscar todos os IDs de líderes verificados
  const fetchAllVerifiedLeaderIds = useCallback(async (): Promise<string[]> => {
    const { data, error } = await supabase.from("lideres").select("id").eq("is_active", true).eq("is_verified", true);

    if (error) throw error;
    return data?.map((l) => l.id) || [];
  }, []);

  const handleWhatsAppClick = (phone: string) => {
    const normalizedPhone = phone?.replace(/\D/g, "");
    if (normalizedPhone) {
      const whatsappUrl = `https://wa.me/${normalizedPhone}`;
      window.open(whatsappUrl, "_blank");
    }
  };

  const handleCopyAffiliateLink = (leader: OfficeLeader) => {
    if (!leader.affiliate_token) {
      toast.error("Token de afiliado não disponível");
      return;
    }
    const link = generateAffiliateUrl(leader.affiliate_token);
    navigator.clipboard.writeText(link);
    setCopiedId(leader.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link de indicação copiado!");
  };

  const handleDownloadQRCode = async (leader: OfficeLeader) => {
    if (!leader.affiliate_token) {
      toast.error("Token de afiliado não disponível");
      return;
    }

    try {
      const affiliateLink = generateAffiliateUrl(leader.affiliate_token);

      const qrDataURL = await QRCode.toDataURL(affiliateLink, {
        width: 1024,
        margin: 4,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      const fileName = `qr-lider-${leader.nome_completo.toLowerCase().replace(/\s+/g, "-")}-${leader.affiliate_token.substring(0, 8)}.png`;

      const link = document.createElement("a");
      link.download = fileName;
      link.href = qrDataURL;
      link.click();

      toast.success("QR Code baixado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      toast.error("Erro ao gerar QR Code");
    }
  };

  // Estatísticas (calculadas a partir dos dados da página atual)
  // totalCount já representa líderes ativos pois a query filtra is_active = true
  const activeLeaders = totalCount;
  const totalPoints = leaders.reduce((sum, l) => sum + l.pontuacao_total, 0);

  // Paginação do backend
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("ellipsis");
      pages.push(totalPages);
    }
    return pages;
  };

  const { restartTutorial } = useTutorial("leaders", leadersTutorialSteps);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <TutorialOverlay page="leaders" />
      {/* Header */}
      <div className="mb-6" data-tutorial="leaders-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestão de Lideranças</h1>
              <TutorialButton onClick={restartTutorial} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground" data-tutorial="leaders-stats">
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                <strong className="text-foreground">{m.number(totalCount, 'leaders_total')}</strong> líderes
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <strong className="text-foreground">{m.number(activeLeaders, 'leaders_active')}</strong> ativos
              </span>
              <span className="flex items-center gap-1.5">
                <Star className="h-4 w-4 text-amber-500" />
                <strong className="text-foreground">{m.number(totalPoints, 'leaders_pts')}</strong> pontos totais
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild data-tutorial="leaders-ranking-btn">
              <Link to="/leaders/ranking">
                <Trophy className="h-4 w-4 mr-2" />
                Ver Ranking
              </Link>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span data-tutorial="leaders-push-btn">
                    <SendPassNotificationDialog
                      allVerifiedCount={verifiedLeadersCount || 0}
                      onSendToAll={fetchAllVerifiedLeaderIds}
                    >
                      <Button variant="outline" size="icon">
                        <Bell className="h-4 w-4" />
                      </Button>
                    </SendPassNotificationDialog>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Notificação Push</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span data-tutorial="leaders-import-btn">
                    <ImportLeadersDialog />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Importar Líderes</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span data-tutorial="leaders-form-btn">
                    <LeaderRegistrationQRDialog>
                      <Button variant="outline" size="icon">
                        <QrCode className="h-4 w-4" />
                      </Button>
                    </LeaderRegistrationQRDialog>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Formulário</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" asChild data-tutorial="leaders-verify-btn">
                    <Link to="/coordenador/verificar" target="_blank">
                      <ShieldCheck className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Verificação via WhatsApp</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <AddLeaderDialog>
              <Button variant="outline" data-tutorial="leaders-add-btn">
                <Users className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </AddLeaderDialog>
          </div>
        </div>
      </div>

      {/* Filtros Horizontais */}
      <div className="bg-card border rounded-lg p-4 mb-6" data-tutorial="leaders-filters">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar líder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedRegion} onValueChange={(v) => handleFilterChange(setSelectedRegion, v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Região" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as regiões</SelectItem>
              {cities?.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={verificationFilter} onValueChange={(v) => handleFilterChange(setVerificationFilter, v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Verificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="verified">✓ Verificados</SelectItem>
              <SelectItem value="not_verified">✗ Não verificados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => handleFilterChange(setSortBy, v)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cadastros_desc">Maior Indicação</SelectItem>
              <SelectItem value="cadastros_asc">Menor Indicação</SelectItem>
              <SelectItem value="pontos_desc">Maior Pontuação</SelectItem>
              <SelectItem value="pontos_asc">Menor Pontuação</SelectItem>
              <SelectItem value="nome_asc">Nome A-Z</SelectItem>
              <SelectItem value="aniversario_proximo">🎂 Próximo Aniversário</SelectItem>
            </SelectContent>
          </Select>

          {/* Botão de Refresh + Timestamp */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Atualizado: {format(lastUpdated, "HH:mm:ss")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Líderes */}
      <div className="space-y-3" data-tutorial="leaders-list">
        {effectiveIsLoading ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Carregando líderes...</p>
            </CardContent>
          </Card>
        ) : leaders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhum líder encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros ou adicionar novos líderes.</p>
            </CardContent>
          </Card>
        ) : (
          leaders.map((leader) => (
            <Card key={leader.id} className={getLeaderCardColorClass(leader.pontuacao_total, leaderLevels)}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Coluna Principal */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Avatar com Iniciais + Coroa para Coordenador */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${getAvatarGradient(leader.nome_completo)}`}
                      >
                        {getInitials(leader.nome_completo)}
                      </div>
                      {leader.is_coordinator && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                          <Crown className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      {/* Nome + Badge Nível + Badge Hierarquia */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-lg text-foreground truncate">{m.name(leader.nome_completo)}</h3>
                        <LeaderLevelBadge points={leader.pontuacao_total} size="sm" levels={leaderLevels} />
                        {(() => {
                          const hierarchyBadge = getHierarchyBadge(leader);
                          if (!hierarchyBadge) return null;
                          return (
                            <Badge variant="outline" className={`text-xs ${hierarchyBadge.className}`}>
                              {leader.is_coordinator && <Crown className="h-3 w-3 mr-1" />}
                              {hierarchyBadge.label}
                            </Badge>
                          );
                        })()}
                        {/* Badge de Aniversário */}
                        {(() => {
                          const birthdayBadge = getBirthdayBadge(leader);
                          if (!birthdayBadge) return null;
                          return (
                            <Badge variant="outline" className={`text-xs ${birthdayBadge.className}`}>
                              {birthdayBadge.label}
                            </Badge>
                          );
                        })()}
                      </div>

                      {/* Região */}
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {m.city(leader.cidade?.nome || leader.localidade || "Sem região")}
                      </p>

                      {/* Badges de Métricas + Status + Verificação + Cartão */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                          📊 {m.number(leader.cadastros + (subordinatesCounts?.[leader.id] || 0), leader.id + '_ind')} indicações
                        </Badge>
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-0">
                          ⭐ {m.number(leader.pontuacao_total, leader.id + '_pts')} pontos
                        </Badge>
                        <Badge
                          variant={leader.is_active ? "default" : "secondary"}
                          className={leader.is_active ? "bg-green-500/10 text-green-600 border-0" : ""}
                        >
                          {leader.is_active ? "✓ Ativo" : "Inativo"}
                        </Badge>
                        {leader.is_verified ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-0">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verificado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            Não verificado
                          </Badge>
                        )}
                        {/* Badge de Cartão Digital */}
                        {leader.passkit_pass_installed ? (
                          <Badge className="bg-violet-500/10 text-violet-600 border-0">
                            <Smartphone className="h-3 w-3 mr-1" />
                            Cartão instalado
                          </Badge>
                        ) : leader.passkit_member_id ? (
                          <Badge variant="outline" className="text-gray-500 border-gray-300">
                            <Smartphone className="h-3 w-3 mr-1" />
                            Cartão não instalado
                          </Badge>
                        ) : null}
                      </div>

                      {/* Contatos */}
                      <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                        {leader.telefone && (
                          <span className="flex items-center gap-1.5">
                            <Phone className="h-4 w-4" />
                            {m.phone(leader.telefone)}
                          </span>
                        )}
                        {leader.email && (
                          <span className="flex items-center gap-1.5">
                            <Mail className="h-4 w-4" />
                            <span className="truncate max-w-[200px]">{m.email(leader.email)}</span>
                          </span>
                        )}
                      </div>

                      {/* Barra de Progresso do Nível */}
                      <div className="mt-3 max-w-md">
                        <LeaderLevelProgress points={leader.pontuacao_total} levels={leaderLevels} />
                      </div>
                    </div>
                  </div>

                  {/* Coluna de Ações - Vertical */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <LeaderDetailsDialog leader={leader}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </LeaderDetailsDialog>
                    <SendPassNotificationDialog leader={leader}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Enviar notificação push">
                        <Bell className="h-4 w-4" />
                      </Button>
                    </SendPassNotificationDialog>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCopyAffiliateLink(leader)}
                      title="Copiar link de indicação"
                    >
                      {copiedId === leader.id ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <EditLeaderDialog leader={leader}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </EditLeaderDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} de{" "}
            {totalCount} líderes
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};

export default Leaders;
