import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_INSIGHTS } from "@/data/public-opinion/demoPublicOpinionData";
import { useMonitoredEntities, useGenerateInsights } from "@/hooks/public-opinion/usePublicOpinion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Lightbulb, AlertTriangle, TrendingUp, Target, Sparkles, Loader2, FileDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import { toast } from "sonner";

const typeConfig: Record<string, any> = {
  opportunity: { icon: Target, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', label: 'Oportunidade' },
  oportunidade: { icon: Target, color: 'text-green-600', bg: 'bg-green-50', badge: 'bg-green-100 text-green-700', label: 'Oportunidade' },
  alert: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Alerta' },
  alerta: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Alerta' },
  trend: { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: 'Tendência' },
  "tendência": { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700', label: 'Tendência' },
  recommendation: { icon: Lightbulb, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', label: 'Recomendação' },
  "recomendação": { icon: Lightbulb, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'bg-yellow-100 text-yellow-700', label: 'Recomendação' },
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700', alta: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700', "média": 'bg-yellow-100 text-yellow-700',
  low: 'bg-green-100 text-green-700', baixa: 'bg-green-100 text-green-700',
};

function usePersistedInsights(entityId?: string) {
  return useQuery({
    queryKey: ["po_insights", entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_insights")
        .select("*")
        .eq("entity_id", entityId!)
        .order("generated_at", { ascending: false })
        .limit(1)
        .single();
      if (error) {
        if (error.code === "PGRST116") return null; // no rows
        throw error;
      }
      return data;
    },
  });
}

const Insights = () => {
  const { data: entities } = useMonitoredEntities();
  const principalEntity = entities?.find(e => e.is_principal) || entities?.[0];
  const generateInsights = useGenerateInsights();
  const queryClient = useQueryClient();
  const { data: persisted, isLoading } = usePersistedInsights(principalEntity?.id);

  const handleGenerate = async () => {
    if (!principalEntity) return;
    await generateInsights.mutateAsync({ entity_id: principalEntity.id, period_days: 7 });
    queryClient.invalidateQueries({ queryKey: ["po_insights", principalEntity.id] });
  };

  const handleExportPDF = () => {
    if (!insights?.length) return;
    try {
      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 16;
      const maxW = pageW - margin * 2;
      let y = 20;

      const addPage = () => { doc.addPage(); y = 20; };
      const checkPage = (needed: number) => { if (y + needed > doc.internal.pageSize.getHeight() - 20) addPage(); };

      // Header
      doc.setFillColor(240, 80, 35);
      doc.rect(0, 0, pageW, 40, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Insights de Opinião Pública", margin, 18);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const dateStr = hasPersistedData
        ? format(new Date(persisted.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      doc.text(`Gerado em ${dateStr}`, margin, 28);
      if (principalEntity) doc.text(`Entidade: ${principalEntity.nome}`, margin, 35);
      y = 50;

      // Stats summary
      if (stats) {
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Resumo da Análise", margin, y);
        y += 8;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const summaryText = `${stats.total} menções analisadas — ${stats.positive} positivas (${Math.round(stats.positive/stats.total*100)}%), ${stats.negative} negativas (${Math.round(stats.negative/stats.total*100)}%), ${stats.neutral} neutras. Score médio: ${(stats.avgScore * 10).toFixed(1)}/10.`;
        const summaryLines = doc.splitTextToSize(summaryText, maxW);
        doc.text(summaryLines, margin, y);
        y += summaryLines.length * 5 + 10;
      }

      // Insights
      const typeLabels: Record<string, string> = {
        opportunity: 'Oportunidade', oportunidade: 'Oportunidade',
        alert: 'Alerta', alerta: 'Alerta',
        trend: 'Tendência', "tendência": 'Tendência',
        recommendation: 'Recomendação', "recomendação": 'Recomendação',
      };
      const priorityLabels: Record<string, string> = {
        high: 'Alta', alta: 'Alta', medium: 'Média', "média": 'Média', low: 'Baixa', baixa: 'Baixa',
      };

      insights.forEach((insight: any, idx: number) => {
        const type = insight.type || 'recommendation';
        const label = typeLabels[type] || 'Recomendação';
        const priority = insight.priority || insight.impact || 'medium';
        const confidence = typeof insight.confidence === 'number'
          ? (insight.confidence <= 1 ? Math.round(insight.confidence * 100) : insight.confidence)
          : 75;

        checkPage(35);

        // Type + priority line
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(240, 80, 35);
        doc.text(`[${label}] Prioridade ${priorityLabels[priority] || 'Média'} • ${confidence}% confiança`, margin, y);
        y += 6;

        // Title
        doc.setFontSize(11);
        doc.setTextColor(30, 30, 30);
        doc.text(insight.title || `Insight ${idx + 1}`, margin, y);
        y += 6;

        // Description
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        const descLines = doc.splitTextToSize(insight.description || '', maxW);
        checkPage(descLines.length * 5 + 5);
        doc.text(descLines, margin, y);
        y += descLines.length * 5;

        // Topics
        if (insight.topics?.length) {
          y += 3;
          doc.setFontSize(8);
          doc.setTextColor(120, 120, 120);
          doc.text(`Tópicos: ${insight.topics.join(', ')}`, margin, y);
          y += 5;
        }

        y += 6; // spacing between insights
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(`Página ${i} de ${totalPages}`, pageW - margin - 25, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`insights-opiniao-publica-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    }
  };

  const hasPersistedData = persisted && (persisted.insights as any[])?.length > 0;
  const insights = hasPersistedData ? (persisted.insights as any[]) : AI_INSIGHTS;
  const stats = hasPersistedData ? (persisted.stats as any) : null;
  const isDemo = !hasPersistedData;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Insights Automáticos</h1>
            <p className="text-muted-foreground mt-1">
              Recomendações geradas por IA baseadas na análise de sentimento
              {isDemo && <Badge variant="outline" className="ml-2">Demo</Badge>}
              {hasPersistedData && (
                <span className="ml-2 text-xs text-muted-foreground">
                  Gerado em {format(new Date(persisted.generated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {insights?.length > 0 && (
            <Button variant="outline" onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          )}
          {principalEntity && (
            <Button
              onClick={handleGenerate}
              disabled={generateInsights.isPending}
            >
              {generateInsights.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {hasPersistedData ? 'Atualizar Insights' : 'Gerar Insights com IA'}
            </Button>
          )}
        </div>
      </div>

      {/* AI Stats */}
      {stats && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-primary">Resumo da Análise</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {stats.total} menções analisadas — {stats.positive} positivas ({Math.round(stats.positive/stats.total*100)}%),
                  {stats.negative} negativas ({Math.round(stats.negative/stats.total*100)}%),
                  {stats.neutral} neutras. Score médio: {(stats.avgScore * 10).toFixed(1)}/10.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!stats && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-primary">Resumo Executivo da Semana</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Sua imagem pública mantém tendência positiva com score de 7.4/10. A inauguração do hospital em Ceilândia foi o evento de maior impacto,
                  gerando +522% em menções positivas. Atenção recomendada para a pauta de segurança em Sobradinho e Gama, onde o sentimento negativo cresceu 18%.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando insights...</span>
        </div>
      )}

      {/* Insights */}
      <div className="space-y-4">
        {insights.map((insight: any, idx: number) => {
          const type = insight.type || 'recommendation';
          const config = typeConfig[type] || typeConfig.recommendation;
          const Icon = config.icon;
          const priority = insight.priority || insight.impact || 'medium';
          const confidence = typeof insight.confidence === 'number'
            ? (insight.confidence <= 1 ? Math.round(insight.confidence * 100) : insight.confidence)
            : 75;
          return (
            <Card key={insight.id || idx} className={`${config.bg} border-0`}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.bg}`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={`${config.badge} border-0 text-xs`}>{config.label}</Badge>
                      <Badge className={`${priorityColors[priority] || priorityColors.medium} border-0 text-xs`}>
                        Prioridade {priority === 'high' || priority === 'alta' ? 'Alta' : priority === 'low' || priority === 'baixa' ? 'Baixa' : 'Média'}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-foreground">{insight.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                    {insight.topics?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {insight.topics.map((t: string) => (
                          <Badge key={t} variant="outline" className="text-xs capitalize">{t}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-24 bg-white rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${confidence}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{confidence}% confiança</span>
                    </div>
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

export default Insights;
