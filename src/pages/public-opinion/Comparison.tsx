import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPETITOR_DATA } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities } from "@/hooks/public-opinion/usePublicOpinion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Legend, Tooltip,
} from "recharts";
import {
  Shield, Swords, Lightbulb, CalendarDays, Brain, Loader2,
  AlertTriangle, TrendingUp, Target, MessageSquare, ThumbsUp, Users, Ban, Check, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

function useEntityStats(entityId?: string, isPrincipal?: boolean) {
  return useQuery({
    queryKey: ["po_comparison_stats", entityId, isPrincipal],
    enabled: !!entityId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const isAdversary = !isPrincipal;
      const pageSize = 1000;

      if (isAdversary) {
        let allAnalyses: any[] = [];
        let from = 0;
        while (true) {
          const { data } = await supabase
            .from("po_sentiment_analyses")
            .select("sentiment, sentiment_score, topics, category, ai_summary, mention_id")
            .eq("adversary_entity_id", entityId!)
            .gte("analyzed_at", since.toISOString())
            .range(from, from + pageSize - 1);
          if (!data || data.length === 0) break;
          allAnalyses = allAnalyses.concat(data);
          if (data.length < pageSize) break;
          from += pageSize;
        }
        const analyses = allAnalyses.filter(isRelevantAnalysis);
        const total = analyses.length;
        const positive = analyses.filter(a => a.sentiment === "positivo").length;
        const negative = analyses.filter(a => a.sentiment === "negativo").length;
        const neutral = analyses.filter(a => a.sentiment === "neutro").length;
        const rawAvg = total > 0 ? analyses.reduce((s: number, a: any) => s + (Number(a.sentiment_score) || 0), 0) / total : 0;
        const sentimentScore = Math.round(((rawAvg + 1) / 2) * 100) / 10;
        const topicCounts: Record<string, number> = {};
        analyses.forEach((a: any) => (a.topics || []).forEach((t: string) => topicCounts[t] = (topicCounts[t] || 0) + 1));
        const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
        const mentionIds = [...new Set(analyses.map((a: any) => a.mention_id))];
        let totalEngagement = 0;
        for (let i = 0; i < mentionIds.length; i += pageSize) {
          const batch = mentionIds.slice(i, i + pageSize);
          const { data: mentions } = await supabase.from("po_mentions").select("id, engagement").in("id", batch);
          (mentions || []).forEach(m => {
            const eng = m.engagement as Record<string, unknown> | null;
            if (eng) totalEngagement += (Number(eng.likes) || 0) + (Number(eng.comments) || 0) + (Number(eng.shares) || 0) + (Number(eng.views) || 0);
          });
        }
        const engRate = mentionIds.length > 0 ? Math.round((totalEngagement / mentionIds.length) * 10) / 10 : 0;
        return { mentions: total, positive_pct: total > 0 ? Math.round((positive / total) * 100) : 0, negative_pct: total > 0 ? Math.round((negative / total) * 100) : 0, neutral_pct: total > 0 ? Math.round((neutral / total) * 100) : 0, sentiment_score: sentimentScore, engagement_total: totalEngagement, engagement_rate: engRate, top_topics: topTopics };
      }

      let allMentions: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase.from("po_mentions").select("id, source, engagement").eq("entity_id", entityId!).gte("collected_at", since.toISOString()).range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allMentions = allMentions.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      let allAnalyses: any[] = [];
      from = 0;
      while (true) {
        const { data } = await supabase.from("po_sentiment_analyses").select("sentiment, sentiment_score, topics, category, ai_summary, mention_id").eq("entity_id", entityId!).gte("analyzed_at", since.toISOString()).range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        allAnalyses = allAnalyses.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      const analyses = allAnalyses.filter(isRelevantAnalysis);
      const mentions = allMentions;
      const total = analyses.length;
      const positive = analyses.filter(a => a.sentiment === "positivo").length;
      const negative = analyses.filter(a => a.sentiment === "negativo").length;
      const neutral = analyses.filter(a => a.sentiment === "neutro").length;
      const rawAvg = total > 0 ? analyses.reduce((s: number, a: any) => s + (Number(a.sentiment_score) || 0), 0) / total : 0;
      const sentimentScore = Math.round(((rawAvg + 1) / 2) * 100) / 10;
      const topicCounts: Record<string, number> = {};
      analyses.forEach((a: any) => (a.topics || []).forEach((t: string) => topicCounts[t] = (topicCounts[t] || 0) + 1));
      const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
      const relevantMentionIds = new Set(analyses.map((a: any) => a.mention_id));
      let totalEngagement = 0;
      mentions.filter(m => relevantMentionIds.has(m.id)).forEach(m => {
        const eng = m.engagement as Record<string, unknown> | null;
        if (eng) totalEngagement += (Number(eng.likes) || 0) + (Number(eng.comments) || 0) + (Number(eng.shares) || 0) + (Number(eng.views) || 0);
      });
      const relevantMentionCount = mentions.filter(m => relevantMentionIds.has(m.id)).length;
      const engRate = relevantMentionCount > 0 ? Math.round((totalEngagement / relevantMentionCount) * 10) / 10 : 0;
      return { mentions: total, positive_pct: total > 0 ? Math.round((positive / total) * 100) : 0, negative_pct: total > 0 ? Math.round((negative / total) * 100) : 0, neutral_pct: total > 0 ? Math.round((neutral / total) * 100) : 0, sentiment_score: sentimentScore, engagement_total: totalEngagement, engagement_rate: engRate, top_topics: topTopics };
    },
  });
}

const Comparison = () => {
  const { data: entities } = useMonitoredEntities();
  const hasRealEntities = entities && entities.length >= 1;

  const e0 = useEntityStats(entities?.[0]?.id, entities?.[0]?.is_principal);
  const e1 = useEntityStats(entities?.[1]?.id, entities?.[1]?.is_principal);
  const e2 = useEntityStats(entities?.[2]?.id, entities?.[2]?.is_principal);
  const e3 = useEntityStats(entities?.[3]?.id, entities?.[3]?.is_principal);
  const e4 = useEntityStats(entities?.[4]?.id, entities?.[4]?.is_principal);
  const statsArr = [e0, e1, e2, e3, e4];

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

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("po-strategic-comparison", {
        body: { entities: comparisonData },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.analysis;
    },
    onSuccess: (data) => {
      setAnalysis(data);
      toast.success("Análise estratégica gerada com sucesso!");
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
        <Button
          onClick={() => analysisMutation.mutate()}
          disabled={analysisMutation.isPending}
          className="gap-2"
        >
          {analysisMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {analysisMutation.isPending ? "Analisando..." : analysis ? "Atualizar Análise IA" : "Gerar Análise IA"}
        </Button>
      </div>

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
        {comparisonData.map((c) => (
          <Card key={c.id} className={c.is_principal ? 'border-primary border-2' : ''}>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white text-xl font-bold" style={{ backgroundColor: c.color }}>
                  {c.nome.charAt(0)}
                </div>
                <h3 className="font-bold mt-2">{c.nome}</h3>
                <Badge variant="outline" className="mt-1">{c.partido}</Badge>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Menções</span><span className="font-semibold">{(c.mentions || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Sentimento</span><span className="font-semibold">{c.sentiment_score || 0}/10</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Eng. Médio</span><span className="font-semibold">{(c.engagement_rate || 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Eng. Total</span><span className="font-semibold">{(c.engagement_total || 0).toLocaleString()}</span></div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(c.top_topics.length > 0 ? c.top_topics : ['Geral']).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
