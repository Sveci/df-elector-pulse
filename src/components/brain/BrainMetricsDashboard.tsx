import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useBrainMetrics, useBrainCacheStats } from "@/hooks/useBrainMetrics";
import { Brain, Database, Zap, TrendingDown, Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const LAYER_COLORS = {
  flow: "hsl(var(--primary))",
  cache: "#10b981",
  kb: "#3b82f6",
  ia: "#f59e0b",
  clarificacao: "#8b5cf6",
};

const chartConfig = {
  flow: { label: "Fluxos", color: LAYER_COLORS.flow },
  cache: { label: "Cache", color: LAYER_COLORS.cache },
  kb: { label: "KB", color: LAYER_COLORS.kb },
  ia: { label: "IA", color: LAYER_COLORS.ia },
  clarificacao: { label: "Clarificação", color: LAYER_COLORS.clarificacao },
};

export function BrainMetricsDashboard() {
  const { data: metrics, isLoading: metricsLoading } = useBrainMetrics();
  const { data: cacheStats, isLoading: cacheLoading } = useBrainCacheStats();

  const totals = useMemo(() => {
    if (!metrics || metrics.length === 0)
      return { total: 0, flow: 0, cache: 0, kb: 0, ia: 0, clarificacoes: 0, economiaPercent: 0 };

    const t = metrics.reduce(
      (acc, m) => ({
        total: acc.total + m.total_mensagens,
        flow: acc.flow + m.resolvidas_por_flow,
        cache: acc.cache + m.resolvidas_por_cache,
        kb: acc.kb + m.resolvidas_por_kb,
        ia: acc.ia + m.resolvidas_por_ia,
        clarificacoes: acc.clarificacoes + m.clarificacoes,
      }),
      { total: 0, flow: 0, cache: 0, kb: 0, ia: 0, clarificacoes: 0 }
    );

    const resolvidasSemIA = t.flow + t.cache + t.kb;
    const economiaPercent = t.total > 0 ? Math.round((resolvidasSemIA / t.total) * 100) : 0;

    return { ...t, economiaPercent };
  }, [metrics]);

  const chartData = useMemo(() => {
    if (!metrics) return [];
    return metrics
      .slice(0, 7)
      .reverse()
      .map((m) => ({
        date: format(parseISO(m.periodo), "dd/MM", { locale: ptBR }),
        flow: m.resolvidas_por_flow,
        cache: m.resolvidas_por_cache,
        kb: m.resolvidas_por_kb,
        ia: m.resolvidas_por_ia,
      }));
  }, [metrics]);

  const layerBreakdown = useMemo(() => {
    return [
      { name: "Fluxos", value: totals.flow, color: LAYER_COLORS.flow },
      { name: "Cache", value: totals.cache, color: LAYER_COLORS.cache },
      { name: "KB", value: totals.kb, color: LAYER_COLORS.kb },
      { name: "IA", value: totals.ia, color: LAYER_COLORS.ia },
    ].filter((l) => l.value > 0);
  }, [totals]);

  if (metricsLoading || cacheLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Cérebro IA</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Cérebro IA — Métricas de Aprendizado</h3>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingDown className="h-4 w-4" />
              Economia de IA
            </div>
            <p className="text-3xl font-bold text-emerald-600">{totals.economiaPercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.flow + totals.cache + totals.kb} de {totals.total} sem IA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Database className="h-4 w-4" />
              Entradas no Cache
            </div>
            <p className="text-3xl font-bold">{cacheStats?.total_entries || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reutilização média: {(cacheStats?.avg_reuse || 0).toFixed(1)}x
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Zap className="h-4 w-4" />
              Cache Hits
            </div>
            <p className="text-3xl font-bold text-emerald-500">{totals.cache}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Respostas instantâneas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Layers className="h-4 w-4" />
              Chamadas IA
            </div>
            <p className="text-3xl font-bold text-amber-500">{totals.ia}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.total > 0 ? Math.round((totals.ia / totals.total) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stacked bar chart - últimos 7 dias */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resoluções por camada (últimos 7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <BarChart data={chartData}>
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="flow" stackId="a" fill={LAYER_COLORS.flow} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="cache" stackId="a" fill={LAYER_COLORS.cache} />
                  <Bar dataKey="kb" stackId="a" fill={LAYER_COLORS.kb} />
                  <Bar dataKey="ia" stackId="a" fill={LAYER_COLORS.ia} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {/* Breakdown horizontal */}
        {layerBreakdown.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Distribuição por camada (total)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[220px] w-full">
                <BarChart data={layerBreakdown} layout="vertical">
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} tickLine={false} axisLine={false} width={60} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {layerBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state */}
      {totals.total === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h4 className="font-medium text-muted-foreground">Cérebro IA em treinamento</h4>
            <p className="text-sm text-muted-foreground/70 mt-1">
              As métricas aparecerão conforme o chatbot receber mensagens e aprender com as interações.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
