import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Users, MessageSquare, ThumbsUp, Eye, Loader2, RefreshCw, Zap, BarChart3 } from "lucide-react";
import { useMonitoredEntities, usePoOverviewStats, useCollectMentions, useAnalyzePending, usePendingMentionsCount } from "@/hooks/public-opinion/usePublicOpinion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { CollectionProgressPanel } from "@/components/public-opinion/CollectionProgressPanel";
import { useQueryClient } from "@tanstack/react-query";

const sourceColors: Record<string, string> = {
  twitter: '#1DA1F2', twitter_comments: '#1DA1F2',
  instagram: '#E4405F', instagram_comments: '#E4405F',
  facebook: '#1877F2', facebook_comments: '#1877F2',
  youtube: '#FF0000', youtube_comments: '#FF0000', youtube_search: '#FF0000',
  tiktok: '#000000', tiktok_comments: '#000000',
  threads: '#000000',
  news: '#6B7280', google_news: '#F59E0B', google_search: '#4285F4',
  portais_df: '#8B5CF6', portais_br: '#7C3AED',
  reddit: '#FF4500', telegram: '#0088CC',
  influencer_comments: '#C13584', sites_custom: '#059669',
  fontes_oficiais: '#1E40AF',
};
const sentimentColors = ['#22c55e', '#ef4444', '#94a3b8'];

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
    <BarChart3 className="h-12 w-12 mb-3 opacity-40" />
    <p className="text-sm">{message}</p>
  </div>
);

const Overview = () => {
  const { data: entities, isLoading: isLoadingEntities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const { stats, snapshots, sourceBreakdown, isLoading: isLoadingStats } = usePoOverviewStats(principalEntity?.id);
  const collectMentions = useCollectMentions();
  const analyzePending = useAnalyzePending();
  const { data: pendingCount = 0 } = usePendingMentionsCount(principalEntity?.id);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleCollectionComplete = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["po_mentions"] });
    qc.invalidateQueries({ queryKey: ["po_overview_stats"] });
    qc.invalidateQueries({ queryKey: ["po_pending_count"] });
  }, [qc]);

  const isLoading = isLoadingEntities || isLoadingStats;

  const hasRealData = !!stats && stats.total > 0;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-72 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>

        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-44" /></CardHeader>
              <CardContent>
                <Skeleton className="h-[280px] w-full rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Timeline skeleton */}
        <Card>
          <CardHeader><Skeleton className="h-5 w-52" /></CardHeader>
          <CardContent>
            <div className="relative">
              <Skeleton className="h-[300px] w-full rounded" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground font-medium">Carregando dados de opinião pública...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overviewData = hasRealData ? {
    total_mentions: stats.total,
    sentiment_score: Math.round((stats.avgScore + 1) * 5 * 10) / 10,
    positive_pct: Math.round(stats.positive / stats.total * 100),
    negative_pct: Math.round(stats.negative / stats.total * 100),
    neutral_pct: Math.round(stats.neutral / stats.total * 100),
    trend: stats.avgScore >= 0 ? 'up' as const : 'down' as const,
    trend_pct: Math.abs(Math.round(stats.avgScore * 100)),
  } : null;

  const sentimentPie = overviewData ? [
    { name: 'Positivo', value: overviewData.positive_pct },
    { name: 'Negativo', value: overviewData.negative_pct },
    { name: 'Neutro', value: overviewData.neutral_pct },
  ] : [];

  const sourceData = sourceBreakdown?.length ? sourceBreakdown : [];

  const timelineData = hasRealData && snapshots?.length
    ? snapshots.map(s => ({
        date: s.snapshot_date,
        positive: s.positive_count,
        negative: s.negative_count,
        neutral: s.neutral_count,
      }))
    : [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral — Opinião Pública</h1>
          <div className="text-gray-500 mt-1 flex items-center gap-2">
            <span>{principalEntity ? `Monitorando: ${principalEntity.nome}` : 'Nenhuma entidade configurada'}</span>
            {hasRealData && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>
        </div>
        {principalEntity && (
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={analyzePending.isPending}
                onClick={() => analyzePending.mutate({ entity_id: principalEntity.id })}
              >
                {analyzePending.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                Analisar Pendentes ({pendingCount})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={collectMentions.isPending || !!activeJobId}
              onClick={() => {
                const sources = ["news", "google_news", "google_search", "portais_df", "portais_br", "fontes_oficiais", "reddit"];
                const redes = principalEntity.redes_sociais as Record<string, any> | null;
                if (redes?.twitter) { sources.push("twitter"); sources.push("twitter_comments"); }
                if (redes?.instagram) { sources.push("instagram"); sources.push("instagram_comments"); }
                if (redes?.facebook) { sources.push("facebook"); sources.push("facebook_comments"); }
                if (redes?.tiktok) { sources.push("tiktok"); sources.push("tiktok_comments"); }
                if (redes?.youtube) { sources.push("youtube_comments"); sources.push("youtube_search"); }
                if (redes?.instagram || redes?.threads) sources.push("threads");
                if (redes?.telegram) sources.push("telegram");
                if (redes?.influenciadores_ig?.length) sources.push("influencer_comments");
                if (redes?.sites_customizados?.length) sources.push("sites_custom");
                collectMentions.mutate(
                  { entity_id: principalEntity.id, sources },
                  {
                    onSuccess: (data) => {
                      if (data?.job_id) {
                        setActiveJobId(data.job_id);
                      }
                    },
                  }
                );
              }}
            >
              {collectMentions.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Coletar Menções
            </Button>
          </div>
        )}
      </div>

      {/* Collection Progress */}
      <CollectionProgressPanel jobId={activeJobId} onComplete={handleCollectionComplete} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Menções Totais</p>
                <p className="text-3xl font-bold">{overviewData?.total_mentions.toLocaleString() ?? '0'}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Score de Sentimento</p>
                <p className="text-3xl font-bold">{overviewData ? `${overviewData.sentiment_score}/10` : '—'}</p>
                {overviewData && (
                  <div className="flex items-center gap-1 mt-1">
                    {overviewData.trend === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
                    <span className={`text-sm ${overviewData.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {overviewData.trend === 'up' ? '+' : '-'}{overviewData.trend_pct}%
                    </span>
                  </div>
                )}
              </div>
              <ThumbsUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alcance Estimado</p>
                <p className="text-3xl font-bold">{hasRealData ? `${(stats.total * 150 / 1000).toFixed(1)}K` : '0'}</p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Engajamento</p>
                <p className="text-3xl font-bold">{hasRealData ? `${Math.round(stats.positive / stats.total * 100)}%` : '0%'}</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Distribuição de Sentimento</CardTitle></CardHeader>
          <CardContent>
            {sentimentPie.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                      {sentimentPie.map((_, i) => <Cell key={i} fill={sentimentColors[i]} />)}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Colete menções para visualizar a distribuição de sentimento" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Menções por Fonte</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))">
                      {sourceData.map((entry, i) => (
                        <Cell key={i} fill={sourceColors[entry.name] || '#6B7280'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="Colete menções para visualizar as fontes" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle>Evolução do Sentimento</CardTitle></CardHeader>
        <CardContent>
          {timelineData.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="positive" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Positivo" />
                  <Area type="monotone" dataKey="neutral" stackId="1" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.4} name="Neutro" />
                  <Area type="monotone" dataKey="negative" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Negativo" />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState message="Colete menções para visualizar a evolução do sentimento ao longo do tempo" />
          )}
        </CardContent>
      </Card>

      {/* Top Topics from real data */}
      {hasRealData && stats.topTopics.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Temas em Destaque</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {stats.topTopics.map((t) => (
                <div key={t.name} className="flex items-center gap-2 border rounded-lg px-4 py-2">
                  <span className="font-semibold text-primary capitalize">{t.name}</span>
                  <Badge variant="secondary">{t.count} menções</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Overview;
