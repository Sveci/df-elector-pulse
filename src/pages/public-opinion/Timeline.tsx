import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ANALYZED_EVENTS } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities, useDailySnapshots, usePoEvents } from "@/hooks/public-opinion/usePublicOpinion";
import { EntitySelector } from "@/components/public-opinion/EntitySelector";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine } from "recharts";
import { Calendar, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DEMO_TIMELINE = [
  { date: '2026-02-01', positive: 62, negative: 18, neutral: 20, mentions: 38 },
  { date: '2026-02-08', positive: 58, negative: 22, neutral: 20, mentions: 45 },
  { date: '2026-02-15', positive: 65, negative: 15, neutral: 20, mentions: 52 },
  { date: '2026-02-22', positive: 70, negative: 12, neutral: 18, mentions: 61 },
  { date: '2026-03-01', positive: 68, negative: 14, neutral: 18, mentions: 55 },
  { date: '2026-03-08', positive: 72, negative: 10, neutral: 18, mentions: 68 },
  { date: '2026-03-15', positive: 74, negative: 12, neutral: 14, mentions: 74 },
];

const Timeline = () => {
  const { data: entities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const resolvedEntityId = selectedEntityId || principalEntity?.id;

  const { data: snapshots } = useDailySnapshots(resolvedEntityId, 60);
  const { data: poEvents } = usePoEvents(resolvedEntityId);
  const navigate = useNavigate();

  const hasRealSnapshots = snapshots && snapshots.length > 0;
  const hasRealEvents = poEvents && poEvents.length > 0;

  const timelineData = hasRealSnapshots
    ? snapshots.map(s => ({
        date: s.snapshot_date,
        positive: s.positive_count > 0 ? Math.round(s.positive_count / s.total_mentions * 100) : 0,
        negative: s.negative_count > 0 ? Math.round(s.negative_count / s.total_mentions * 100) : 0,
        neutral: s.neutral_count > 0 ? Math.round(s.neutral_count / s.total_mentions * 100) : 0,
        mentions: s.total_mentions,
      }))
    : DEMO_TIMELINE;

  const eventsData = hasRealEvents
    ? poEvents.map(e => ({
        id: e.id,
        title: e.titulo,
        date: e.data_evento,
        type: e.tipo,
        summary: e.descricao || e.ai_analysis || '',
        sentiment_before: 0.5,
        sentiment_after: (e.sentiment_positivo_pct - e.sentiment_negativo_pct) / 100,
        mentions_before: 0,
        mentions_after: e.total_mentions,
        reach: e.total_mentions * 150,
        impact_score: e.impacto_score || 0,
      }))
    : ANALYZED_EVENTS;

  const isDemo = !hasRealSnapshots && !hasRealEvents;

  // Find peak and trough dates
  const peakDay = timelineData.length > 0
    ? timelineData.reduce((best, d) => d.mentions > best.mentions ? d : best, timelineData[0])
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Linha do Tempo</h1>
          <p className="text-gray-500 mt-1">
            Cronologia de menções e sentimentos correlacionados com eventos públicos
            {isDemo && <Badge variant="outline" className="ml-2">Demo</Badge>}
          </p>
          {peakDay && hasRealSnapshots && (
            <p className="text-xs text-muted-foreground mt-1">
              Pico de menções: <strong>{new Date(peakDay.date).toLocaleDateString('pt-BR')}</strong> ({peakDay.mentions} menções)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EntitySelector value={resolvedEntityId} onChange={setSelectedEntityId} className="w-[200px]" />
          {resolvedEntityId && (
            <Button size="sm" variant="outline" onClick={() => navigate("/public-opinion/events")}>
              <Plus className="h-4 w-4 mr-1" />
              Novo Evento
            </Button>
          )}
        </div>
      </div>

      {/* Mentions over time */}
      <Card>
        <CardHeader>
          <CardTitle>Volume de Menções ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                />
                <Bar dataKey="mentions" fill="hsl(var(--primary))" name="Menções" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sentiment trend */}
      <Card>
        <CardHeader>
          <CardTitle>Sentimento Positivo vs Negativo (Tendência)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Legend />
                <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: '50%', position: 'right', fontSize: 11 }} />
                <Line type="monotone" dataKey="positive" stroke="#22c55e" strokeWidth={2} name="Positivo %" dot={false} />
                <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} name="Negativo %" dot={false} />
                <Line type="monotone" dataKey="neutral" stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" name="Neutro %" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Events Timeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Eventos na Linha do Tempo</CardTitle>
            {eventsData.length === 0 && resolvedEntityId && (
              <Button size="sm" onClick={() => navigate("/public-opinion/events")}>
                <Plus className="h-4 w-4 mr-1" /> Registrar Evento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {eventsData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum evento registrado para esta entidade.</p>
              <p className="text-sm mt-1">Acesse "Eventos Analisados" para registrar eventos e correlacioná-los com os dados de sentimento.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-6">
                {eventsData.map((event) => {
                  const sentimentDiff = event.sentiment_after - event.sentiment_before;
                  return (
                    <div key={event.id} className="relative flex gap-4 pl-10">
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary border-2 border-white shadow" />
                      <div className="border rounded-lg p-4 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {new Date(event.date).toLocaleDateString('pt-BR')}
                          </span>
                          <Badge variant="outline">{event.type}</Badge>
                          {sentimentDiff > 0 ? (
                            <Badge className="bg-green-100 text-green-700 border-0">
                              <TrendingUp className="h-3 w-3 mr-1" /> +{(sentimentDiff * 100).toFixed(0)}% sentimento
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-0">
                              <TrendingDown className="h-3 w-3 mr-1" /> {(sentimentDiff * 100).toFixed(0)}% sentimento
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold">{event.title}</h3>
                        {event.summary && (
                          <p className="text-sm text-gray-600 mt-1">{event.summary}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Menções: {event.mentions_before} → {event.mentions_after.toLocaleString()}</span>
                          <span>Alcance: {(event.reach / 1000).toFixed(0)}K</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Timeline;
