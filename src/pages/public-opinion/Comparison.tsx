import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COMPETITOR_DATA } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities } from "@/hooks/public-opinion/usePublicOpinion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Shield, Swords, Lightbulb, CalendarDays, Brain, Loader2,
  AlertTriangle, TrendingUp, Target, MessageSquare, ThumbsUp, Users, Ban, Check, ChevronRight, Download,
  CalendarIcon, ChevronDown, ChevronUp, Filter,
} from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { generateComparisonPdf } from "@/utils/generateComparisonReportPdf";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const entityColors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#22c55e'];

const IRRELEVANT_KEYWORDS = [
  "irrelevante", "sem relação", "sem cunho político", "não se refere",
  "não está relacionad", "sem conexão", "não menciona", "sem relevância",
  "não é sobre", "sem vínculo", "conteúdo genérico",
];

function isRelevantAnalysis(a: any): boolean {
  if (a.ai_summary) {
    const lower = a.ai_summary.toLowerCase();
    if (IRRELEVANT_KEYWORDS.some((kw: string) => lower.includes(kw))) return false;
  }
  if (a.category === "humor" && (a.sentiment_score === 0 || a.sentiment_score === null)) return false;
  return true;
}

const ASPECTS = [
  "Conexão Popular e Carisma",
  "Posicionamento em Segurança Pública",
  "Associação Política (Centrão)",
  "Entrega de Resultados (Saúde/Infraestrutura)",
  "Reconhecimento de Atuação Federal",
  "Apoio à Cultura Local",
];

const ASPECT_KEYS = [
  "conexao_popular", "causas_especificas", "associacao_politica",
  "entrega_resultados", "atuacao_federal", "cultura_local",
];

// ── Fast stats using po_daily_snapshots (pre-aggregated) ──
function useEntityStatsFromSnapshots(entityId?: string, isPrincipal?: boolean, dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ["po_comparison_stats_fast", entityId, isPrincipal, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    enabled: !!entityId,
    staleTime: 60_000,
    queryFn: async () => {
      const fromDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : format(subDays(new Date(), 30), "yyyy-MM-dd");
      const toDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const isAdversary = !isPrincipal;

      if (isAdversary) {
        // Adversaries don't have snapshots, use a single count query
        const { count: total } = await supabase
          .from("po_sentiment_analyses")
          .select("id", { count: "exact", head: true })
          .eq("adversary_entity_id", entityId!)
          .gte("analyzed_at", `${fromDate}T00:00:00.000Z`)
          .lte("analyzed_at", `${toDate}T23:59:59.999Z`);

        const { data: sentimentCounts } = await (supabase as any).rpc("get_adversary_sentiment_counts", {
          p_entity_id: entityId,
          p_from: `${fromDate}T00:00:00.000Z`,
          p_to: `${toDate}T23:59:59.999Z`,
        }).maybeSingle();

        // Fallback: fetch a small sample for topics
        const { data: topicSample } = await supabase
          .from("po_sentiment_analyses")
          .select("sentiment, sentiment_score, topics")
          .eq("adversary_entity_id", entityId!)
          .gte("analyzed_at", `${fromDate}T00:00:00.000Z`)
          .lte("analyzed_at", `${toDate}T23:59:59.999Z`)
          .order("analyzed_at", { ascending: false })
          .limit(200);

        const analyses = (topicSample || []).filter(isRelevantAnalysis);
        const totalCount = total || analyses.length;
        const positive = sentimentCounts?.positive || analyses.filter((a: any) => a.sentiment === "positivo").length;
        const negative = sentimentCounts?.negative || analyses.filter((a: any) => a.sentiment === "negativo").length;
        const neutral = sentimentCounts?.neutral || analyses.filter((a: any) => a.sentiment === "neutro").length;
        const rawAvg = analyses.length > 0 ? analyses.reduce((s: number, a: any) => s + (Number(a.sentiment_score) || 0), 0) / analyses.length : 0;
        const sentimentScore = Math.round(((rawAvg + 1) / 2) * 100) / 10;
        const topicCounts: Record<string, number> = {};
        analyses.forEach((a: any) => (a.topics || []).forEach((t: string) => topicCounts[t] = (topicCounts[t] || 0) + 1));
        const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

        return { mentions: totalCount, positive_pct: totalCount > 0 ? Math.round((positive / totalCount) * 100) : 0, negative_pct: totalCount > 0 ? Math.round((negative / totalCount) * 100) : 0, neutral_pct: totalCount > 0 ? Math.round((neutral / totalCount) * 100) : 0, sentiment_score: sentimentScore, engagement_total: 0, engagement_rate: 0, top_topics: topTopics };
      }

      // Principal entity: use po_daily_snapshots for speed
      const { data: snapshots } = await supabase
        .from("po_daily_snapshots")
        .select("total_mentions, positive_count, negative_count, neutral_count, avg_sentiment_score, top_topics")
        .eq("entity_id", entityId!)
        .gte("snapshot_date", fromDate)
        .lte("snapshot_date", toDate);

      if (!snapshots || snapshots.length === 0) {
        return { mentions: 0, positive_pct: 0, negative_pct: 0, neutral_pct: 0, sentiment_score: 0, engagement_total: 0, engagement_rate: 0, top_topics: [] };
      }

      let totalMentions = 0, totalPos = 0, totalNeg = 0, totalNeu = 0, totalScore = 0, scoreCount = 0;
      const topicCounts: Record<string, number> = {};
      snapshots.forEach((s: any) => {
        totalMentions += s.total_mentions || 0;
        totalPos += s.positive_count || 0;
        totalNeg += s.negative_count || 0;
        totalNeu += s.neutral_count || 0;
        if (s.avg_sentiment_score != null) { totalScore += s.avg_sentiment_score * (s.total_mentions || 1); scoreCount += (s.total_mentions || 1); }
        (s.top_topics || []).forEach((t: any) => {
          const name = typeof t === "string" ? t : t.name;
          const count = typeof t === "string" ? 1 : (t.count || 1);
          if (name) topicCounts[name] = (topicCounts[name] || 0) + count;
        });
      });

      const total = totalPos + totalNeg + totalNeu || totalMentions;
      const rawAvg = scoreCount > 0 ? totalScore / scoreCount : 0;
      const sentimentScore = Math.round(((rawAvg + 1) / 2) * 100) / 10;
      const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

      return {
        mentions: totalMentions, positive_pct: total > 0 ? Math.round((totalPos / total) * 100) : 0,
        negative_pct: total > 0 ? Math.round((totalNeg / total) * 100) : 0,
        neutral_pct: total > 0 ? Math.round((totalNeu / total) * 100) : 0,
        sentiment_score: sentimentScore, engagement_total: 0, engagement_rate: 0, top_topics: topTopics,
      };
    },
  });
}

const Comparison = () => {
  const { data: entities } = useMonitoredEntities();
  const hasRealEntities = entities && entities.length >= 1;
  
  // Date range filter state
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const resolvedRange = dateRange?.from ? { from: dateRange.from, to: dateRange.to || dateRange.from } : { from: subDays(new Date(), 30), to: new Date() };

  const e0 = useEntityStatsFromSnapshots(entities?.[0]?.id, entities?.[0]?.is_principal, resolvedRange);
  const e1 = useEntityStatsFromSnapshots(entities?.[1]?.id, entities?.[1]?.is_principal, resolvedRange);
  const e2 = useEntityStatsFromSnapshots(entities?.[2]?.id, entities?.[2]?.is_principal, resolvedRange);
  const e3 = useEntityStatsFromSnapshots(entities?.[3]?.id, entities?.[3]?.is_principal, resolvedRange);
  const e4 = useEntityStatsFromSnapshots(entities?.[4]?.id, entities?.[4]?.is_principal, resolvedRange);
  const statsArr = [e0, e1, e2, e3, e4];
  const isLoadingStats = statsArr.some((s, i) => entities?.[i] && s.isLoading);

  // History of analyses
  const { data: analysisHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["po_strategic_analysis_history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_strategic_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });
  const [historyDialogItem, setHistoryDialogItem] = useState<any>(null);

  const comparisonData = hasRealEntities
    ? entities.map((e, i) => {
        const s = statsArr[i]?.data;
        return {
          id: e.id, nome: e.nome, partido: e.partido || '-',
          mentions: s?.mentions || 0, positive_pct: s?.positive_pct || 0,
          negative_pct: s?.negative_pct || 0, neutral_pct: s?.neutral_pct || 0,
          sentiment_score: s?.sentiment_score || 0, engagement_total: s?.engagement_total || 0,
          engagement_rate: s?.engagement_rate || 0,
          top_topics: s?.top_topics?.length ? s.top_topics : e.palavras_chave?.slice(0, 3) || [],
          color: entityColors[i % entityColors.length], is_principal: e.is_principal,
        };
      })
    : COMPETITOR_DATA.map(c => ({ ...c, is_principal: c.id === '1', engagement_total: c.followers_total }));

  const [analysis, setAnalysis] = useState<any>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Load last saved analysis
  const { data: lastSavedAnalysis, isLoading: isLoadingSavedAnalysis } = useQuery({
    queryKey: ["po_strategic_analysis_last"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_strategic_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (lastSavedAnalysis && !analysis) {
      setAnalysis(lastSavedAnalysis.analysis);
      setSavedAt(lastSavedAnalysis.created_at);
    }
  }, [lastSavedAnalysis]);

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("po-strategic-comparison", {
        body: { entities: comparisonData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.analysis;
    },
    onSuccess: async (data) => {
      setAnalysis(data);

      if (user?.id) {
        // Delete all previous analyses before inserting the new one
        await supabase.from("po_strategic_analyses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        const { error } = await supabase
          .from("po_strategic_analyses")
          .insert({
            analysis: data,
            comparison_data: comparisonData,
            created_by: user.id,
          });
        if (error) {
          console.error("Erro ao salvar análise:", error);
          toast.error("Análise gerada mas não foi possível salvar.");
        } else {
          const now = new Date().toISOString();
          setSavedAt(now);
          queryClient.invalidateQueries({ queryKey: ["po_strategic_analysis_last"] });
          toast.success("Análise estratégica gerada e salva com sucesso!");
        }
      } else {
        toast.success("Análise estratégica gerada com sucesso!");
      }
    },
    onError: (err: any) => {
      toast.error(`Erro ao gerar análise: ${err.message}`);
    },
  });

  const isDemo = !hasRealEntities;
  const principal = comparisonData.find(c => c.is_principal) || comparisonData[0];

  const fraquezasCount = analysis?.fraquezas?.length || 0;
  const forcasCount = analysis?.forcas?.length || 0;
  const oportunidadesCount = analysis?.oportunidades?.length || 0;
  const acoesCount = analysis?.plano_cobertura?.cronograma_14_dias?.length || 0;

  // Helper to find principal in radar_scores by fuzzy match
  const findPrincipalRadar = (radarScores: any[]) => {
    if (!principal?.nome || !radarScores) return null;
    const exactMatch = radarScores.find((rs: any) => rs.entity_name === principal.nome);
    if (exactMatch) return exactMatch;
    const lowerName = principal.nome.toLowerCase();
    return radarScores.find((rs: any) =>
      rs.entity_name?.toLowerCase().includes(lowerName) ||
      lowerName.includes(rs.entity_name?.toLowerCase())
    ) || radarScores[0];
  };

  // Build radar data from AI analysis
  const radarData = analysis?.radar_scores
    ? ASPECTS.map((aspect, i) => {
        const entry: any = { metric: aspect.length > 25 ? aspect.substring(0, 22) + '...' : aspect, fullMetric: aspect };
        (analysis.radar_scores as any[]).forEach((rs: any) => {
          entry[rs.entity_name] = rs.scores[ASPECT_KEYS[i]] || 0;
        });
        return entry;
      })
    : null;

  // Heatmap data - use fuzzy match for principal
  const principalRadar = findPrincipalRadar(analysis?.radar_scores);
  const heatmapData = analysis?.radar_scores
    ? ASPECTS.map((aspect, i) => {
        const principalScore = principalRadar?.scores[ASPECT_KEYS[i]] || 0;
        const gaps = analysis.radar_scores
          .filter((rs: any) => rs !== principalRadar)
          .map((rs: any) => ({
            adversary: rs.entity_name,
            score: rs.scores[ASPECT_KEYS[i]] || 0,
            gap: principalScore - (rs.scores[ASPECT_KEYS[i]] || 0),
          }));
        return { aspect, principalScore, gaps };
      })
    : null;

  const impactColor = (impact: string) => {
    if (impact === 'alto') return 'text-red-600 bg-red-50 border-red-200';
    if (impact === 'medio') return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const prioridadeColor = (p: string) => {
    if (p === 'alta') return 'destructive';
    if (p === 'media') return 'secondary';
    return 'outline';
  };

  const gapCellColor = (gap: number) => {
    if (gap > 20) return 'bg-green-100 text-green-800';
    if (gap > 0) return 'bg-green-50 text-green-700';
    if (gap > -20) return 'bg-red-50 text-red-700';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Análise Estratégica Comparativa</h1>
          <p className="text-muted-foreground mt-1">
            Comparação multidimensional com insights de IA
            {isDemo && <Badge variant="outline" className="ml-2">Demo</Badge>}
          </p>
        </div>
        <div className="flex gap-2">
          {analysis && (
            <Button
              variant="outline"
              onClick={() => generateComparisonPdf(comparisonData, analysis)}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </Button>
          )}
          <Button
            onClick={() => analysisMutation.mutate()}
            disabled={analysisMutation.isPending}
            className="gap-2"
          >
            {analysisMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {analysisMutation.isPending ? "Analisando..." : analysis ? "Atualizar Análise IA" : "Gerar Análise IA"}
          </Button>
        </div>
        {savedAt && (
          <p className="text-xs text-muted-foreground">
            Última análise salva em {new Date(savedAt).toLocaleDateString("pt-BR")} às {new Date(savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Período:</span>
            <div className="flex gap-2 flex-wrap">
              {[7, 15, 30, 60].map(days => (
                <Button
                  key={days}
                  variant={
                    dateRange?.from && Math.round((new Date().getTime() - dateRange.from.getTime()) / 86400000) === days
                      ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setDateRange({ from: subDays(new Date(), days), to: new Date() })}
                >
                  {days} dias
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd/MM/yy")} — {format(dateRange.to, "dd/MM/yy")}</>
                    ) : format(dateRange.from, "dd/MM/yy")
                  ) : "Selecionar datas"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  disabled={{ after: new Date() }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Summary Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={fraquezasCount > 0 ? "border-red-200 bg-red-50/50" : ""}>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100"><Swords className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{fraquezasCount}</p>
              <p className="text-xs text-muted-foreground">Fraquezas</p>
            </div>
          </CardContent>
        </Card>
        <Card className={forcasCount > 0 ? "border-green-200 bg-green-50/50" : ""}>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100"><Shield className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{forcasCount}</p>
              <p className="text-xs text-muted-foreground">Forças</p>
            </div>
          </CardContent>
        </Card>
        <Card className={oportunidadesCount > 0 ? "border-amber-200 bg-amber-50/50" : ""}>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Lightbulb className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{oportunidadesCount}</p>
              <p className="text-xs text-muted-foreground">Oportunidades IA</p>
            </div>
          </CardContent>
        </Card>
        <Card className={acoesCount > 0 ? "border-blue-200 bg-blue-50/50" : ""}>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><CalendarDays className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{acoesCount}</p>
              <p className="text-xs text-muted-foreground">Ações Plano</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Entity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {comparisonData.map((c, idx) => {
          const isLoading = hasRealEntities && statsArr[idx]?.isLoading;
          return (
            <Card key={c.id} className={c.is_principal ? 'border-primary border-2' : ''}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: c.color }}>
                    {c.nome.charAt(0)}
                  </div>
                  <h3 className="font-bold mt-2">{c.nome}</h3>
                  <Badge variant="outline" className="mt-1">{c.partido}</Badge>
                </div>
                {isLoading ? (
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Menções</span><span className="font-semibold">{(c.mentions || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Sentimento</span><span className="font-semibold">{c.sentiment_score || 0}/10</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Eng. Médio</span><span className="font-semibold">{(c.engagement_rate || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Eng. Total</span><span className="font-semibold">{(c.engagement_total || 0).toLocaleString()}</span></div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(c.top_topics.length > 0 ? c.top_topics : ['Geral']).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Per-Date Analysis */}
      {hasRealEntities && principalEntity && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Análises por Data — {principalEntity.nome}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dateDetail.isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : !dateDetail.data?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum dado encontrado para o período selecionado.</p>
            ) : (
              <div className="space-y-2">
                {dateDetail.data.map((snap: any) => {
                  const isExpanded = expandedDate === snap.snapshot_date;
                  const total = (snap.positive_count || 0) + (snap.negative_count || 0) + (snap.neutral_count || 0);
                  const posPct = total > 0 ? Math.round((snap.positive_count / total) * 100) : 0;
                  const negPct = total > 0 ? Math.round((snap.negative_count / total) * 100) : 0;
                  const neuPct = total > 0 ? Math.round((snap.neutral_count / total) * 100) : 0;
                  return (
                    <div key={snap.snapshot_date} className="border rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedDate(isExpanded ? null : snap.snapshot_date)}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-medium text-sm text-foreground min-w-[90px]">
                            {format(new Date(snap.snapshot_date + "T12:00:00"), "dd/MM/yyyy")}
                          </span>
                          <Badge variant="outline" className="gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {snap.total_mentions || 0} menções
                          </Badge>
                          <div className="hidden sm:flex items-center gap-2 text-xs">
                            <span className="text-green-600">▲ {posPct}%</span>
                            <span className="text-muted-foreground">● {neuPct}%</span>
                            <span className="text-red-600">▼ {negPct}%</span>
                          </div>
                          {snap.avg_sentiment_score != null && (
                            <Badge variant="secondary" className="text-xs">
                              Score: {(Math.round(((snap.avg_sentiment_score + 1) / 2) * 100) / 10).toFixed(1)}
                            </Badge>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <div className="border-t p-4 bg-muted/30 space-y-4">
                          {/* Sentiment breakdown bar */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">Distribuição de Sentimento</p>
                            <div className="flex h-6 rounded-md overflow-hidden">
                              {posPct > 0 && <div className="bg-green-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${posPct}%` }}>{posPct}%</div>}
                              {neuPct > 0 && <div className="bg-gray-400 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${neuPct}%` }}>{neuPct}%</div>}
                              {negPct > 0 && <div className="bg-red-500 flex items-center justify-center text-xs text-white font-medium" style={{ width: `${negPct}%` }}>{negPct}%</div>}
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              <span>✅ {snap.positive_count || 0} positivas</span>
                              <span>⬜ {snap.neutral_count || 0} neutras</span>
                              <span>❌ {snap.negative_count || 0} negativas</span>
                            </div>
                          </div>

                          {/* Top topics */}
                          {snap.top_topics && snap.top_topics.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Principais Tópicos</p>
                              <div className="flex flex-wrap gap-1.5">
                                {snap.top_topics.slice(0, 8).map((t: any, i: number) => {
                                  const name = typeof t === "string" ? t : t.name;
                                  const count = typeof t === "string" ? null : t.count;
                                  return (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {name}{count ? ` (${count})` : ""}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Top emotions */}
                          {snap.top_emotions && snap.top_emotions.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Emoções Detectadas</p>
                              <div className="flex flex-wrap gap-1.5">
                                {snap.top_emotions.slice(0, 6).map((e: any, i: number) => {
                                  const name = typeof e === "string" ? e : e.name;
                                  const count = typeof e === "string" ? null : e.count;
                                  return <Badge key={i} variant="outline" className="text-xs">{name}{count ? ` (${count})` : ""}</Badge>;
                                })}
                              </div>
                            </div>
                          )}

                          {/* Source breakdown */}
                          {snap.source_breakdown && snap.source_breakdown.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">Fontes</p>
                              <div className="flex flex-wrap gap-2">
                                {snap.source_breakdown.map((s: any, i: number) => (
                                  <div key={i} className="flex items-center gap-1.5 text-xs bg-background border rounded-md px-2 py-1">
                                    <span className="font-medium">{s.name}</span>
                                    <span className="text-muted-foreground">({s.count})</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-muted-foreground pt-1 border-t">
                            Total de menções analisadas nesta data: <span className="font-semibold text-foreground">{snap.total_mentions || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!analysis && !analysisMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Análise Estratégica com IA</h3>
            <p className="text-muted-foreground mb-4">Clique em "Gerar Análise IA" para obter radar de aspectos, fraquezas, forças, oportunidades e plano de cobertura.</p>
          </CardContent>
        </Card>
      )}

      {analysisMutation.isPending && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">A IA está analisando os dados comparativos...</p>
            <div className="space-y-2 max-w-sm mx-auto">
              {["Avaliando aspectos estratégicos...", "Identificando fraquezas e forças...", "Gerando plano de cobertura..."].map(t => (
                <Skeleton key={t} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Tabs defaultValue="radar" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="radar" className="gap-1"><Target className="h-3.5 w-3.5" /> Radar & Heatmap</TabsTrigger>
            <TabsTrigger value="fraquezas" className="gap-1"><Swords className="h-3.5 w-3.5" /> Fraquezas</TabsTrigger>
            <TabsTrigger value="forcas" className="gap-1"><Shield className="h-3.5 w-3.5" /> Forças</TabsTrigger>
            <TabsTrigger value="oportunidades" className="gap-1"><Lightbulb className="h-3.5 w-3.5" /> Oportunidades IA</TabsTrigger>
            <TabsTrigger value="plano" className="gap-1"><CalendarDays className="h-3.5 w-3.5" /> Plano 14 dias</TabsTrigger>
          </TabsList>

          {/* Tab 1: Radar + Heatmap */}
          <TabsContent value="radar" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Radar de Aspectos</CardTitle></CardHeader>
              <CardContent>
                {radarData && (
                  <div className="h-[450px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis domain={[0, 100]} />
                        {analysis.radar_scores.map((rs: any, i: number) => (
                          <Radar key={rs.entity_name} name={rs.entity_name} dataKey={rs.entity_name}
                            stroke={entityColors[i % entityColors.length]} fill={entityColors[i % entityColors.length]} fillOpacity={0.15} />
                        ))}
                        <Legend />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Heatmap — Gap por Aspecto</CardTitle></CardHeader>
              <CardContent>
                {heatmapData && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aspecto</TableHead>
                          <TableHead className="text-center">{principal?.nome}</TableHead>
                          {comparisonData.filter(c => !c.is_principal).map(c => (
                            <TableHead key={c.id} className="text-center">{c.nome}</TableHead>
                          ))}
                          {comparisonData.filter(c => !c.is_principal).map(c => (
                            <TableHead key={`gap-${c.id}`} className="text-center">Gap vs {c.nome.split(' ')[0]}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {heatmapData.map((row) => (
                          <TableRow key={row.aspect}>
                            <TableCell className="font-medium text-xs max-w-[200px]">{row.aspect}</TableCell>
                            <TableCell className="text-center font-bold">{row.principalScore}</TableCell>
                            {row.gaps.map((g: any) => (
                              <TableCell key={g.adversary} className="text-center">{g.score}</TableCell>
                            ))}
                            {row.gaps.map((g: any) => (
                              <TableCell key={`gap-${g.adversary}`} className={`text-center font-semibold ${gapCellColor(g.gap)}`}>
                                {g.gap > 0 ? '+' : ''}{g.gap}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Fraquezas */}
          <TabsContent value="fraquezas" className="space-y-4">
            {analysis.fraquezas?.map((f: any, i: number) => (
              <Card key={i} className="border-red-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-red-100 mt-1"><AlertTriangle className="h-5 w-5 text-red-600" /></div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{f.aspecto}</h3>
                        <Badge className={impactColor(f.impacto)} variant="outline">Impacto {f.impacto}</Badge>
                        {f.score_principal !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            Score: {f.score_principal} vs {f.score_melhor_adversario} ({f.adversario_referencia})
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium text-muted-foreground">Definição:</span> {f.definicao}</p>
                        <p><span className="font-medium text-muted-foreground">Por que é fraqueza:</span> {f.por_que_fraqueza}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!analysis.fraquezas || analysis.fraquezas.length === 0) && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma fraqueza identificada pela IA.</CardContent></Card>
            )}
          </TabsContent>

          {/* Tab 3: Forças */}
          <TabsContent value="forcas" className="space-y-4">
            {analysis.forcas?.map((f: any, i: number) => (
              <Card key={i} className="border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-green-100 mt-1"><Shield className="h-5 w-5 text-green-600" /></div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{f.aspecto}</h3>
                        <Badge className={impactColor(f.impacto).replace('red', 'green')} variant="outline">Impacto {f.impacto}</Badge>
                        {f.score_principal !== undefined && (
                          <Badge variant="outline" className="text-xs">
                            Score: {f.score_principal} vs {f.score_melhor_adversario}
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium text-muted-foreground">Definição:</span> {f.definicao}</p>
                        <p><span className="font-medium text-muted-foreground">Por que é força:</span> {f.por_que_forca}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!analysis.forcas || analysis.forcas.length === 0) && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma força identificada pela IA.</CardContent></Card>
            )}
          </TabsContent>

          {/* Tab 4: Oportunidades IA */}
          <TabsContent value="oportunidades" className="space-y-4">
            {analysis.oportunidades?.map((o: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-amber-100 mt-1"><Lightbulb className="h-5 w-5 text-amber-600" /></div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-foreground">{o.titulo}</h3>
                        <Badge variant={prioridadeColor(o.prioridade) as any}>Prioridade {o.prioridade}</Badge>
                        {o.aspecto_relacionado && <Badge variant="outline" className="text-xs">{o.aspecto_relacionado}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{o.descricao}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!analysis.oportunidades || analysis.oportunidades.length === 0) && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma oportunidade identificada pela IA.</CardContent></Card>
            )}
          </TabsContent>

          {/* Tab 5: Plano de Cobertura */}
          <TabsContent value="plano" className="space-y-6">
            {analysis.plano_cobertura && (
              <>
                {/* Mensagens Recomendadas */}
                <Card className="border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700"><Check className="h-5 w-5" /> Mensagens Recomendadas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.plano_cobertura.mensagens_recomendadas?.map((m: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
                        <ChevronRight className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.mensagem}</p>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">{m.canal}</Badge>
                            <span className="text-xs text-muted-foreground">{m.objetivo}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Mensagens a Evitar */}
                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-700"><Ban className="h-5 w-5" /> Mensagens a Evitar</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis.plano_cobertura.mensagens_evitar?.map((m: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-red-50/50 border border-red-100">
                        <Ban className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.mensagem}</p>
                          <p className="text-xs text-muted-foreground mt-1">{m.motivo}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Cronograma 14 dias */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Plano de Cobertura — 14 dias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysis.plano_cobertura.cronograma_14_dias?.map((d: any, i: number) => {
                        const weekNum = Math.ceil(d.dia / 7);
                        const weekColors = weekNum === 1
                          ? "border-l-primary bg-primary-100/30"
                          : "border-l-info-500 bg-blue-50/30";
                        return (
                          <div
                            key={i}
                            className={`rounded-lg border border-border ${weekColors} border-l-4 p-4 flex flex-col gap-2 transition-shadow hover:shadow-md`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-sm px-2.5 py-1">
                                Dia {d.dia}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs font-medium">{d.canal}</Badge>
                              </div>
                            </div>
                            <p className="text-sm font-medium text-foreground leading-snug">{d.acao}</p>
                            <div className="flex items-center gap-1.5 mt-auto">
                              <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                              <span className="text-xs text-muted-foreground">{d.aspecto_foco}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default Comparison;
