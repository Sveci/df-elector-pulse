import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, MessageSquare, Heart, Eye, Loader2, RefreshCw, Zap, BarChart3, Activity } from "lucide-react";
import { PerplexitySearchPanel } from "@/components/public-opinion/PerplexitySearchPanel";
import { useMonitoredEntities, usePoOverviewStats, useCollectMentions, useAnalyzePending, usePendingMentionsCount } from "@/hooks/public-opinion/usePublicOpinion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { CollectionProgressPanel } from "@/components/public-opinion/CollectionProgressPanel";
import { AlertsPanel } from "@/components/public-opinion/AlertsPanel";
import { SentimentGauge } from "@/components/public-opinion/SentimentGauge";
import { TrendDeltaBadge } from "@/components/public-opinion/TrendDeltaBadge";
import { EntitySelector } from "@/components/public-opinion/EntitySelector";
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
  fontes_oficiais: '#1E40AF', perplexity_web: '#20B2AA',
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
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);

  // Resolved entity: use selected or fall back to principal
  const resolvedEntityId = selectedEntityId || principalEntity?.id;
  const resolvedEntity = entities?.find(e => e.id === resolvedEntityId) || principalEntity;

  const { stats, snapshots, sourceBreakdown, isLoading: isLoadingStats } = usePoOverviewStats(resolvedEntityId);
  const collectMentions = useCollectMentions();
  const analyzePending = useAnalyzePending();
  const { data: pendingCount = 0 } = usePendingMentionsCount(resolvedEntityId);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleCollectionComplete = useCallback(() => {
    setActiveJobId(null);
    qc.invalidateQueries({ queryKey: ["po_mentions"] });
    qc.invalidateQueries({ queryKey: ["po_overview_stats"] });
    qc.invalidateQueries({ queryKey: ["po_pending_count"] });
    qc.invalidateQueries({ queryKey: ["po_collection_jobs"] });
  }, [qc]);

  const isLoading = isLoadingEntities || isLoadingStats;

  const hasRealData = !!stats && stats.total > 0;

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-72 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
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

  // Sentiment score on 0-10 scale
  const sentimentScore = stats ? Math.round((stats.avgScore + 1) * 5 * 10) / 10 : 0;
  const positivePct = stats ? Math.round(stats.positive / stats.total * 100) : 0;
  const negativePct = stats ? Math.round(stats.negative / stats.total * 100) : 0;
  const neutralPct = stats ? Math.round(stats.neutral / stats.total * 100) : 0;

  const sentimentPie = hasRealData ? [
    { name: 'Positivo', value: positivePct },
    { name: 'Negativo', value: negativePct },
    { name: 'Neutro', value: neutralPct },
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

  const trend = stats && stats.avgScore >= 0 ? 'up' : 'down';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral — Opinião Pública</h1>
          <div className="text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>{resolvedEntity ? `Monitorando: ${resolvedEntity.nome}` : 'Nenhuma entidade configurada'}</span>
            {hasRealData && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Ao vivo
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Entity selector (only if multiple entities) */}
          <EntitySelector
            value={resolvedEntityId}
            onChange={setSelectedEntityId}
            className="w-[200px]"
          />
          {resolvedEntity && (
            <PerplexitySearchPanel entityName={resolvedEntity.nome} entityId={resolvedEntity.id} />
          )}
          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={analyzePending.isPending}
              onClick={() => resolvedEntityId && analyzePending.mutate({ entity_id: resolvedEntityId })}
            >
              {analyzePending.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Analisar Pendentes ({pendingCount})
            </Button>
          )}
          {resolvedEntity && (
            <Button
              variant="outline"
              size="sm"
              disabled={collectMentions.isPending || !!activeJobId}
              onClick={() => {
                const sources = ["news", "google_news", "google_search", "portais_df", "portais_br", "fontes_oficiais", "reddit", "perplexity_web"];
                const redes = resolvedEntity.redes_sociais as Record<string, any> | null;
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
                  { entity_id: resolvedEntity.id, sources },
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
          )}
        </div>
      </div>

      {/* Alerts panel */}
      <AlertsPanel entityId={resolvedEntityId} />

      {/* Collection Progress */}
      <CollectionProgressPanel jobId={activeJobId} entityId={resolvedEntityId} onComplete={handleCollectionComplete} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total mentions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Menções Totais (30d)</p>
                <p className="text-3xl font-bold">{hasRealData ? stats.total.toLocaleString('pt-BR') : '0'}</p>
                <TrendDeltaBadge entityId={resolvedEntityId} metric="mentions" className="mt-1" />
              </div>
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        {/* Sentiment gauge */}
        <Card className="overflow-hidden">
          <CardContent className="pt-4 pb-2">
            <p className="text-sm text-muted-foreground mb-1">Score de Sentimento</p>
            {hasRealData ? (
              <div className="flex flex-col items-center">
                <SentimentGauge score={sentimentScore} size={120} showLabel={false} />
                <div className="flex items-center gap-2 mt-1">
                  {trend === 'up'
                    ? <TrendingUp className="h-4 w-4 text-green-500" />
                    : <TrendingDown className="h-4 w-4 text-red-500" />}
                  <TrendDeltaBadge entityId={resolvedEntityId} metric="score" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-3xl font-bold">—</p>
                <Heart className="h-8 w-8 text-green-500" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estimated reach */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alcance Estimado</p>
                <p className="text-3xl font-bold">
                  {hasRealData
                    ? stats.estimatedReach >= 1_000_000
                      ? `${(stats.estimatedReach / 1_000_000).toFixed(1)}M`
                      : `${(stats.estimatedReach / 1000).toFixed(1)}K`
                    : '0'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {hasRealData && stats.totalEngagement > 0
                    ? `${stats.totalEngagement.toLocaleString('pt-BR')} interações`
                    : 'Base: volume de menções'}
                </p>
              </div>
              <Eye className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        {/* Positive sentiment % */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sentimento Positivo</p>
                <p className="text-3xl font-bold">{hasRealData ? `${positivePct}%` : '0%'}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  {hasRealData && (
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      <span className="text-red-500">{negativePct}% neg</span>
                      <span>·</span>
                      <span className="text-gray-400">{neutralPct}% neu</span>
                    </div>
                  )}
                </div>
                <TrendDeltaBadge entityId={resolvedEntityId} metric="positive" className="mt-1" />
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
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
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
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
        <CardHeader>
          <CardTitle>Evolução do Sentimento (30 dias)</CardTitle>
        </CardHeader>
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
