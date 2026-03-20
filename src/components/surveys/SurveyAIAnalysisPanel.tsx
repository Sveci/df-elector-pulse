import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, RefreshCw, Sparkles, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import type { Survey, SurveyQuestion } from "@/hooks/surveys/useSurveys";

interface SurveyAIAnalysisPanelProps {
  survey: Survey;
  questions: SurveyQuestion[];
  responses: any[];
}

export function SurveyAIAnalysisPanel({ survey, questions, responses }: SurveyAIAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const { user } = useAuth();

  // Calculate response stats
  const totalResponses = responses.length;
  const leaderResponses = responses.filter(r => r.is_leader).length;
  const referredResponses = responses.filter(r => r.referred_by_leader_id).length;

  // Load last analysis on mount
  useEffect(() => {
    loadLastAnalysis();
  }, [survey.id]);

  const loadLastAnalysis = async () => {
    try {
      const { data, error } = await supabase
        .from("survey_analyses")
        .select("*")
        .eq("survey_id", survey.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setAnalysis(data.content);
        setSavedAt(data.created_at);
      }
    } catch (err) {
      // No analysis found, that's ok
    }
  };

  const saveAnalysis = async (content: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from("survey_analyses")
        .insert({
          survey_id: survey.id,
          user_id: user.id,
          content,
          total_responses: totalResponses,
          leader_responses: leaderResponses,
          referred_responses: referredResponses,
        });

      if (error) throw error;

      setSavedAt(new Date().toISOString());
      toast.success("Análise salva com sucesso");
    } catch (err) {
      console.error("Erro ao salvar análise:", err);
    }
  };

  const downloadPdf = () => {
    if (!analysis) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // Helper to add page number
    const addPageNumber = (pageNum: number) => {
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      pdf.text(
        `Página ${pageNum}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    };

    // Helper to check page break
    const checkPageBreak = (neededHeight: number) => {
      if (yPos + neededHeight > pageHeight - 25) {
        addPageNumber(pdf.getNumberOfPages());
        pdf.addPage();
        yPos = margin;
        return true;
      }
      return false;
    };

    // Title
    pdf.setFontSize(18);
    pdf.setTextColor(0);
    pdf.text(`Análise de Pesquisa`, margin, yPos);
    yPos += 10;

    pdf.setFontSize(14);
    pdf.setTextColor(80);
    pdf.text(survey.titulo, margin, yPos);
    yPos += 10;

    // Date
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text(
      `Gerado em: ${format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}`,
      margin,
      yPos
    );
    yPos += 15;

    // Stats
    pdf.setFontSize(11);
    pdf.setTextColor(0);
    pdf.text(`Total de Respostas: ${totalResponses}`, margin, yPos);
    yPos += 6;
    pdf.text(`Respostas de Líderes: ${leaderResponses}`, margin, yPos);
    yPos += 6;
    pdf.text(`Respostas por Indicação: ${referredResponses}`, margin, yPos);
    yPos += 15;

    // Divider
    pdf.setDrawColor(200);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Analysis content - convert markdown to plain text
    const plainText = analysis
      .replace(/#{1,6}\s/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/\n{3,}/g, "\n\n");

    pdf.setFontSize(11);
    pdf.setTextColor(40);

    const lines = pdf.splitTextToSize(plainText, contentWidth);

    for (const line of lines) {
      checkPageBreak(7);
      pdf.text(line, margin, yPos);
      yPos += 6;
    }

    addPageNumber(pdf.getNumberOfPages());

    // Save PDF
    pdf.save(`analise-pesquisa-${survey.slug}.pdf`);
    toast.success("PDF gerado com sucesso");
  };

  const generateAnalysis = async () => {
    if (responses.length === 0) {
      setError("Não há respostas suficientes para análise");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis("");

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-survey`;

      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          survey,
          questions,
          responses: responses.map(r => ({
            respostas: r.respostas,
            is_leader: r.is_leader,
            has_referrer: !!r.referred_by_leader_id,
            created_at: r.created_at,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao gerar análise");
      }

      if (!response.body) {
        throw new Error("Resposta sem corpo");
      }

      // Stream SSE response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullAnalysis = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullAnalysis += content;
              setAnalysis(prev => prev + content);
            }
          } catch {
            // Incomplete JSON, wait for more data
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save analysis after streaming completes
      if (fullAnalysis) {
        await saveAnalysis(fullAnalysis);
      }
    } catch (err) {
      console.error("Erro na análise:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Análise com Inteligência Artificial</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {analysis && !isLoading && (
              <Button variant="outline" onClick={downloadPdf}>
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>
            )}
            <Button
              onClick={generateAnalysis}
              disabled={isLoading || responses.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : analysis ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Análise
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Análise
                </>
              )}
            </Button>
          </div>
        </div>
        {savedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Última análise: {format(new Date(savedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {responses.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Aguardando respostas para gerar análise
            </p>
          </div>
        ) : !analysis && !isLoading && !error ? (
          <div className="text-center py-8">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">
              Clique em "Gerar Análise" para obter insights sobre as respostas
            </p>
            <p className="text-sm text-muted-foreground">
              A análise inclui resumo executivo, principais insights, oportunidades e recomendações estratégicas
            </p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={generateAnalysis}>
              Tentar Novamente
            </Button>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {analysis || "Gerando análise..."}
            </ReactMarkdown>
            {isLoading && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
