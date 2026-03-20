import { PageHeader } from "@/components/PageHeader";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy,
  Phone,
  ArrowLeft,
  TrendingUp,
  Award,
  Medal,
  Crown
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLeadersRanking } from "@/hooks/leaders/useLeadersRanking";
import { useLeaderLevels } from "@/hooks/leaders/useLeaderLevels";
import { useRegions } from "@/hooks/useRegions";
import { LeaderLevelBadge, LeaderLevelProgress } from "@/components/leaders/LeaderLevelBadge";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { TutorialButton } from "@/components/TutorialButton";
import type { Step } from "react-joyride";

const rankingTutorialSteps: Step[] = [
  {
    target: '[data-tutorial="ranking-header"]',
    title: '🏆 Ranking de Lideranças',
    content: 'Visualize a classificação completa de todos os líderes ordenados por desempenho.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '[data-tutorial="ranking-filters"]',
    title: '🔍 Filtros do Ranking',
    content: 'Filtre por período (mês atual, mês passado, trimestre, ano) e por região administrativa.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="ranking-podium"]',
    title: '🥇 Pódio dos Campeões',
    content: 'Os 3 líderes com melhor desempenho aparecem em destaque no pódio com suas estatísticas.',
    placement: 'bottom',
  },
  {
    target: '[data-tutorial="ranking-full"]',
    title: '📊 Ranking Completo',
    content: 'Lista completa de todos os líderes com posição, pontos, indicações e tendência de desempenho.',
    placement: 'top',
  },
];

const ITEMS_PER_PAGE = 20;

const LeadersRanking = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { restartTutorial } = useTutorial("leaders-ranking", rankingTutorialSteps);

  // Buscar dados reais do banco
  const { data: rankingResult, isLoading } = useLeadersRanking({
    region: selectedRegion,
    period: selectedPeriod,
    page: currentPage,
    pageSize: ITEMS_PER_PAGE
  });

  const rankingData = rankingResult?.data || [];
  const totalCount = rankingResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const { data: allRegions = [] } = useRegions();
  const { data: leaderLevels = [] } = useLeaderLevels();
  const regions = allRegions.map(r => r.nome).sort();

  const handleWhatsAppClick = (phone: string) => {
    if (!phone) return;
    const normalizedPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${normalizedPhone}`;
    window.open(whatsappUrl, '_blank');
  };

  const formatPhone = (phone: string) => {
    if (!phone) return "Sem telefone";
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 13) {
      return `(${clean.slice(2,4)}) ${clean.slice(4,9)}-${clean.slice(9)}`;
    }
    return phone;
  };

  const getTrophyIcon = (position: number) => {
    switch (position) {
      case 1: return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2: return <Medal className="h-6 w-6 text-gray-400" />;
      case 3: return <Award className="h-6 w-6 text-orange-600" />;
      default: return null;
    }
  };

  const getTrophyBg = (position: number) => {
    switch (position) {
      case 1: return "bg-yellow-50 border-yellow-200";
      case 2: return "bg-gray-50 border-gray-200";
      case 3: return "bg-orange-50 border-orange-200";
      default: return "bg-gray-50 border-gray-100";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down": return <TrendingUp className="h-4 w-4 text-red-500 rotate-180" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "up": return "text-green-600 bg-green-50";
      case "down": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  // A paginação agora é feita no servidor
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedRanking = rankingData;

  // Reset página ao mudar filtros
  const handleFilterChange = (callback: () => void) => {
    callback();
    setCurrentPage(1);
  };

  return (
    <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">
      <TutorialOverlay page="leaders-ranking" />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8" data-tutorial="ranking-header">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center mb-2">
                <Button variant="ghost" asChild className="mr-2 w-fit">
                  <Link to="/leaders">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Link>
                </Button>
                <PageHeader icon={Trophy} title="Ranking Detalhado de Lideranças">
                  <TutorialButton onClick={restartTutorial} />
                </PageHeader>
              </div>
              <p className="text-sm sm:text-base text-gray-600">
                Classificação completa com histórico de desempenho
              </p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <Card className="card-default mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Período:
                </label>
                <Select value={selectedPeriod} onValueChange={(v) => handleFilterChange(() => setSelectedPeriod(v))}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Mês Atual</SelectItem>
                    <SelectItem value="last">Mês Passado</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Região:
                </label>
                <Select value={selectedRegion} onValueChange={(v) => handleFilterChange(() => setSelectedRegion(v))}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Regiões</SelectItem>
                    {regions.map(region => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:ml-auto w-full sm:w-auto">
                <Badge className="badge-brand w-full sm:w-auto justify-center">
                  {totalCount.toLocaleString('pt-BR')} líderes no ranking
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-6">
            <Card className="card-default">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-4">
                      <Skeleton className="h-12 w-12 rounded-full mx-auto" />
                      <Skeleton className="h-6 w-32 mx-auto" />
                      <Skeleton className="h-8 w-16 mx-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : rankingData.length === 0 ? (
          /* Mensagem quando vazio */
          <Card className="card-default">
            <CardContent className="p-8 text-center">
              <Trophy className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhum líder encontrado
              </h3>
              <p className="text-gray-600">
                {selectedRegion !== 'all'
                  ? 'Não há líderes ativos nesta região.'
                  : 'Não há líderes cadastrados no momento.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pódio TOP 3 */}
            {rankingData.length >= 1 && (
              <Card className="card-default mb-6">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center text-base sm:text-lg">
                    <Trophy className="h-5 w-5 text-primary-600 mr-2" />
                    🏆 Pódio dos Campeões
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    {rankingData.slice(0, 3).map((leader, index) => (
                <div
                  key={leader.id}
                  className={`relative p-6 rounded-xl border-2 ${getTrophyBg(index + 1)}`}
                >
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-4">
                      {getTrophyIcon(index + 1)}
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full ${
                        index === 0 ? 'bg-yellow-500' :
                        index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                      }`}>
                        {index + 1}º
                      </span>
                    </div>

                    <h3 className="font-bold text-gray-900 text-lg mb-1">
                      {leader.name}
                    </h3>

                    <div className="flex justify-center mb-2">
                      <LeaderLevelBadge points={leader.points} size="md" />
                    </div>

                    {leader.region === 'Sem região' ? (
                      <Badge variant="outline" className="text-gray-500 mb-2">Sem região</Badge>
                    ) : (
                      <p className="text-sm text-gray-600 mb-2">{leader.region}</p>
                    )}

                    <div className="space-y-3">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary-600">
                          {leader.points}
                        </p>
                        <p className="text-sm text-gray-600">pontos</p>
                      </div>

                      <LeaderLevelProgress points={leader.points} showLabel={false} />

                      <div className="text-center p-2 bg-white/50 rounded text-sm">
                        <p className="font-semibold">{leader.indicacoes}</p>
                        <p className="text-gray-600">indicações</p>
                      </div>

                      {leader.phone ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleWhatsAppClick(leader.phone)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 w-full"
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          {formatPhone(leader.phone)}
                        </Button>
                      ) : (
                        <div className="text-sm text-gray-500">Sem telefone</div>
                      )}

                      <div className="flex items-center justify-center space-x-1">
                        {getTrendIcon(leader.trend)}
                        <span className={`text-xs px-2 py-1 rounded-full ${getTrendColor(leader.trend)}`}>
                          {leader.trend === "up" ? "Subindo" :
                           leader.trend === "down" ? "Descendo" : "Estável"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ranking Completo */}
            <Card className="card-default">
              <CardHeader>
                <CardTitle>📊 Ranking Completo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paginatedRanking.map((leader, index) => {
                    const globalIndex = startIndex + index;
                    return (
                      <div
                        key={leader.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          globalIndex < 3 ? getTrophyBg(globalIndex + 1) : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center justify-center w-10 h-10 bg-primary-100 text-primary-600 rounded-lg font-bold">
                            {globalIndex + 1}º
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-gray-900">{leader.name}</h4>
                              <LeaderLevelBadge points={leader.points} size="sm" />
                            </div>
                            {leader.region === 'Sem região' ? (
                              <Badge variant="outline" className="text-gray-500 text-xs">Sem região</Badge>
                            ) : (
                              <p className="text-sm text-gray-600">{leader.region}</p>
                            )}
                          </div>
                        </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <p className="font-bold text-primary-600">{leader.points}</p>
                      <p className="text-xs text-gray-600">pontos</p>
                    </div>

                    <div className="text-center">
                      <p className="font-semibold text-gray-900">{leader.indicacoes}</p>
                      <p className="text-xs text-gray-600">indicações</p>
                    </div>

                        <div className="flex items-center space-x-2">
                          {getTrendIcon(leader.trend)}
                          {leader.phone ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleWhatsAppClick(leader.phone)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              title={formatPhone(leader.phone)}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          ) : (
                            <div className="text-xs text-gray-400">Sem telefone</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>

                        {[...Array(totalPages)].map((_, i) => {
                          const pageNum = i + 1;
                          // Mostrar apenas algumas páginas
                          if (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(pageNum)}
                                  isActive={currentPage === pageNum}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Informações do Sistema de Pontuação */}
        <Card className="card-default mt-6">
          <CardHeader>
            <CardTitle>ℹ️ Sistema de Pontuação Gamificado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Como ganhar pontos:</h4>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded text-xs font-bold">+1</span>
                    <span>Cadastro de indicação (contato, evento, visita)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded text-xs font-bold">+1</span>
                    <span>Contato indicado se cadastra em landing page</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-bold">+2</span>
                    <span>Check-in em evento ou visita indicada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-bold">+2</span>
                    <span>Download de material (primeira vez)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-bold">+1</span>
                    <span>Líder se inscreve em evento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-xs font-bold">+2</span>
                    <span>Líder faz check-in em evento</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-bold">+1</span>
                    <span>Líder responde uma pesquisa</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-bold">+2</span>
                    <span>Contato indicado responde pesquisa</span>
                  </li>
                </ul>
              </div>
              <div>
              <h4 className="font-semibold text-gray-900 mb-3">Níveis de Liderança:</h4>
              <div className="space-y-3">
                {leaderLevels.map((level) => (
                  <div
                    key={level.name}
                    className={`flex items-center justify-between p-2 rounded-lg border ${level.bgClass} ${level.borderClass}`}
                  >
                    <span className="font-medium">{level.icon} {level.name}</span>
                    <span className="text-gray-600">
                      {level.max === Infinity
                        ? `${level.min}+ pontos`
                        : `${level.min}-${level.max} pontos`
                      }
                    </span>
                  </div>
                ))}
              </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">O que conta como Indicação:</h4>
                <ul className="space-y-2 text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600">•</span>
                    <span>Contatos cadastrados pelo seu link</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600">•</span>
                    <span>Inscrições em eventos com sua indicação</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600">•</span>
                    <span>Respostas de pesquisas com sua referência</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary-600">•</span>
                    <span>Líderes que você indicou diretamente</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LeadersRanking;