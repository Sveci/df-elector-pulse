import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMonitoredEntities, useSentimentAnalyses, useMentions, useDailySnapshots } from "@/hooks/public-opinion/usePublicOpinion";
import { EntitySelector } from "@/components/public-opinion/EntitySelector";
import { TrendDeltaBadge } from "@/components/public-opinion/TrendDeltaBadge";
import { AlertsPanel } from "@/components/public-opinion/AlertsPanel";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { ThumbsUp, ThumbsDown, Minus } from "lucide-react";

const defaultCategoryScores = [
  { category: 'Saúde', score: 8.2 },
  { category: 'Educação', score: 7.8 },
  { category: 'Segurança', score: 4.5 },
  { category: 'Infraestrutura', score: 7.1 },
  { category: 'Economia', score: 6.3 },
  { category: 'Meio Ambiente', score: 5.9 },
];

const sentimentIcon = (s: string) => {
  if (s === 'positive' || s === 'positivo') return <ThumbsUp className="h-4 w-4 text-green-500" />;
  if (s === 'negative' || s === 'negativo') return <ThumbsDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
};

const DEMO_TIMELINE = [
  { date: '2026-02-01', positive: 62, negative: 18 },
  { date: '2026-02-08', positive: 58, negative: 22 },
  { date: '2026-02-15', positive: 65, negative: 15 },
  { date: '2026-02-22', positive: 70, negative: 12 },
  { date: '2026-03-01', positive: 68, negative: 14 },
];

const SentimentAnalysis = () => {
  const { data: entities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const resolvedEntityId = selectedEntityId || principalEntity?.id;
  const resolvedEntity = entities?.find(e => e.id === resolvedEntityId) || principalEntity;

  const { data: analyses } = useSentimentAnalyses(resolvedEntityId);
  const { data: mentions } = useMentions(resolvedEntityId, undefined, 50);
  const { data: snapshots } = useDailySnapshots(resolvedEntityId, 30);

  const hasRealAnalyses = analyses && analyses.length > 0;
  const hasRealSnapshots = snapshots && snapshots.length > 0;

  // Build category scores from real analyses or fallback
  const categoryScores = hasRealAnalyses
    ? (() => {
        const catMap: Record<string, { total: number; sum: number }> = {};
        analyses.forEach(a => {
          const cat = a.category || 'Outros';
          if (!catMap[cat]) catMap[cat] = { total: 0, sum: 0 };
          catMap[cat].total++;
          catMap[cat].sum += a.sentiment_score || 0;
        });
        return Object.entries(catMap)
          .map(([category, { total, sum }]) => ({
            category,
            score: Math.round(((sum / total + 1) * 5) * 10) / 10,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);
      })()
    : defaultCategoryScores;

  // Timeline: use real snapshots when available, otherwise demo
  // Bug fix: was using SENTIMENT_TIMELINE even when snapshots existed
  const timelineData = hasRealSnapshots
    ? snapshots.map(s => ({
        date: s.snapshot_date,
        positive: s.total_mentions > 0 ? Math.round(s.positive_count / s.total_mentions * 100) : 0,
        negative: s.total_mentions > 0 ? Math.round(s.negative_count / s.total_mentions * 100) : 0,
      }))
    : DEMO_TIMELINE;

  // Build analysis map for mentions
  const analysisMap = new Map(analyses?.map(a => [a.mention_id, a]) || []);

  // Recent classified comments from real data or demo
  const DEMO_COMMENTS = [
    { id: '1', author: 'Cidadão DF', source: 'twitter', content: 'Ótimo trabalho na área de saúde! Continue assim.', sentiment: 'positive', category: 'elogio' },
    { id: '2', author: 'Morador de Ceilândia', source: 'instagram', content: 'Precisamos de mais atenção para a segurança pública.', sentiment: 'negative', category: 'reclamação' },
    { id: '3', author: 'Estudante', source: 'facebook', content: 'Aprovação do projeto de educação foi importante.', sentiment: 'positive', category: 'notícia' },
  ];

  const recentComments = hasRealAnalyses && mentions && mentions.length > 0
    ? mentions.slice(0, 5).map(m => {
        const a = analysisMap.get(m.id);
        return {
          id: m.id,
          author: m.author_name || m.author_handle || 'Anônimo',
          source: m.source,
          content: m.content,
          sentiment: a?.sentiment === 'positivo' ? 'positive' : a?.sentiment === 'negativo' ? 'negative' : 'neutral',
          category: a?.category || 'sem categoria',
        };
      })
    : DEMO_COMMENTS;

  const isDemo = !hasRealAnalyses && !hasRealSnapshots;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise de Sentimento</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            Análise detalhada do sentimento público por categoria e ao longo do tempo
            {isDemo && <Badge variant="outline" className="ml-2">Demo</Badge>}
            {!isDemo && (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Ao vivo
              </span>
            )}
          </p>
          {!isDemo && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <TrendDeltaBadge entityId={resolvedEntityId} metric="positive" />
              <TrendDeltaBadge entityId={resolvedEntityId} metric="negative" />
              <TrendDeltaBadge entityId={resolvedEntityId} metric="mentions" />
            </div>
          )}
        </div>
        <EntitySelector value={resolvedEntityId} onChange={setSelectedEntityId} className="w-[200px]" />
      </div>

      {/* Alerts */}
      <AlertsPanel entityId={resolvedEntityId} />

      {/* Sentiment by Category (Radar) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Sentimento por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={categoryScores}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} />
                  <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Resumo de Categorização</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {categoryScores.map((c) => (
                <div key={c.category} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{c.category}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full ${c.score >= 7 ? 'bg-green-500' : c.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${c.score * 10}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold w-10 text-right">{c.score}/10</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Evolução Temporal do Sentimento
            {isDemo && <Badge variant="outline" className="text-xs font-normal">Demo</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Area type="monotone" dataKey="positive" stroke="#22c55e" fill="#22c55e" fillOpacity={0.5} name="Positivo %" />
                <Area type="monotone" dataKey="negative" stroke="#ef4444" fill="#ef4444" fillOpacity={0.5} name="Negativo %" />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent classified comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Menções Classificadas Recentes
            {isDemo && <Badge variant="outline" className="text-xs font-normal">Demo</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentComments.map((c) => (
              <div key={c.id} className="flex items-start gap-3 border rounded-lg p-3">
                {sentimentIcon(c.sentiment)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{c.author}</span>
                    <Badge variant="outline" className="text-xs">{c.source}</Badge>
                    <Badge
                      variant={c.sentiment === 'positive' ? 'default' : c.sentiment === 'negative' ? 'destructive' : 'secondary'}
                      className="text-xs capitalize"
                    >
                      {c.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SentimentAnalysis;
