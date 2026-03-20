import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ANALYZED_EVENTS } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities, usePoEvents } from "@/hooks/public-opinion/usePublicOpinion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Eye, MessageSquare, Award } from "lucide-react";

const AnalyzedEvents = () => {
  const { data: entities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const { data: poEvents } = usePoEvents(principalEntity?.id);

  const hasRealData = poEvents && poEvents.length > 0;

  const eventsData = hasRealData
    ? poEvents.map(e => ({
        id: e.id,
        title: e.titulo,
        date: e.data_evento,
        type: e.tipo,
        mentions_before: 0,
        mentions_after: e.total_mentions,
        sentiment_before: 0.5,
        sentiment_after: e.sentiment_positivo_pct / 100,
        reach: e.total_mentions * 150,
        top_reaction: e.sentiment_positivo_pct > 60 ? 'Aprovação' : e.sentiment_negativo_pct > 40 ? 'Crítica' : 'Divisão',
        impact_score: e.impacto_score || 5,
        summary: e.descricao || e.ai_analysis || 'Sem descrição disponível.',
      }))
    : ANALYZED_EVENTS;

  const impactData = eventsData.map(e => ({
    name: e.title.substring(0, 20) + '...',
    impact: e.impact_score,
    mentions: e.mentions_after,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader icon={Calendar} title="Eventos Analisados" subtitle="Análise do impacto de eventos públicos na opinião popular">
        {!hasRealData && <Badge variant="outline">Demo</Badge>}
      </PageHeader>

      {/* Impact Chart */}
      <Card>
        <CardHeader><CardTitle>Score de Impacto por Evento</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={impactData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 10]} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="impact" name="Score de Impacto" radius={[0, 4, 4, 0]}>
                  {impactData.map((entry, i) => (
                    <Cell key={i} fill={eventsData[i]?.impact_score >= 8 ? '#22c55e' : eventsData[i]?.impact_score >= 6 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Event Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {eventsData.map((event) => {
          const sentDiff = event.sentiment_after - event.sentiment_before;
          const mentionIncrease = event.mentions_before > 0
            ? ((event.mentions_after - event.mentions_before) / event.mentions_before * 100).toFixed(0)
            : event.mentions_after > 0 ? '∞' : '0';
          return (
            <Card key={event.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="capitalize">{event.type}</Badge>
                  <div className="flex items-center gap-1">
                    <Award className="h-4 w-4 text-primary" />
                    <span className="font-bold text-lg">{event.impact_score}/10</span>
                  </div>
                </div>
                <CardTitle className="text-lg">{event.title}</CardTitle>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(event.date).toLocaleDateString('pt-BR')}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{event.summary}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <MessageSquare className="h-3 w-3" /> Menções
                    </div>
                    <p className="font-semibold">{event.mentions_before} → {event.mentions_after.toLocaleString()}</p>
                    <p className="text-xs text-green-600">+{mentionIncrease}%</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      {sentDiff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Sentimento
                    </div>
                    <p className="font-semibold">{(event.sentiment_before * 100).toFixed(0)}% → {(event.sentiment_after * 100).toFixed(0)}%</p>
                    <p className={`text-xs ${sentDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>{sentDiff >= 0 ? '+' : ''}{(sentDiff * 100).toFixed(0)}pp</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Eye className="h-3 w-3" /> Alcance
                    </div>
                    <p className="font-semibold">{(event.reach / 1000).toFixed(0)}K</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-muted-foreground mb-1 text-xs">Reação Principal</div>
                    <Badge variant={event.top_reaction === 'Aprovação' ? 'default' : event.top_reaction === 'Divisão' ? 'secondary' : 'outline'}>
                      {event.top_reaction}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AnalyzedEvents;
