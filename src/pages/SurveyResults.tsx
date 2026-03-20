import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Users,
  BarChart3,
  Brain,
  Loader2,
  AlertCircle,
  Download,
  RefreshCw,
  ClipboardList
} from "lucide-react";
import {
  useSurvey,
  useSurveyQuestions,
  useSurveyResponses
} from "@/hooks/surveys/useSurveys";
import { SurveyResponsesTable } from "@/components/surveys/SurveyResponsesTable";
import { SurveyResultsCharts } from "@/components/surveys/SurveyResultsCharts";
import { SurveyAIAnalysisPanel } from "@/components/surveys/SurveyAIAnalysisPanel";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDemoMode } from "@/hooks/useDemoMode";
import { DEMO_SURVEYS } from "@/data/surveys/demoSurveys";
import { DEMO_SURVEY_QUESTIONS, getDemoSurveyResponses } from "@/data/surveys/demoSurveyResults";

export default function SurveyResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isDemoMode } = useDemoMode();

  // Use "demo-" prefix as definitive check to avoid race condition with async isDemoMode
  const isDemo = !!id?.startsWith("demo-");

  const { data: dbSurvey, isLoading: loadingSurvey } = useSurvey(isDemo ? undefined : id);
  const { data: dbQuestions, isLoading: loadingQuestions } = useSurveyQuestions(isDemo ? undefined : id);
  const { data: dbResponses, isLoading: loadingResponses, refetch } = useSurveyResponses(isDemo ? undefined : id);

  const survey = isDemo ? (DEMO_SURVEYS.find(s => s.id === id) || null) : dbSurvey;
  const questions = isDemo ? (DEMO_SURVEY_QUESTIONS[id!] || []) : dbQuestions;
  const responses = useMemo(() => isDemo ? getDemoSurveyResponses(id!) : dbResponses, [isDemo, id, dbResponses]);

  const isLoading = !isDemo && (loadingSurvey || loadingQuestions || loadingResponses);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Pesquisa não encontrada</h2>
        <Button onClick={() => navigate("/surveys")}>Voltar para Pesquisas</Button>
      </div>
    );
  }

  const leaderResponses = responses?.filter(r => r.is_leader) || [];
  const referredResponses = responses?.filter(r => r.referred_by_leader_id) || [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/surveys")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader icon={ClipboardList} title={survey.titulo} subtitle="Resultados e análise da pesquisa">
            <Badge variant={survey.status === "active" ? "default" : "secondary"}>
              {survey.status === "active" ? "Ativa" : survey.status === "closed" ? "Encerrada" : "Rascunho"}
            </Badge>
          </PageHeader>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Respostas</p>
              <p className="text-2xl font-bold">{isDemo ? (responses?.length || 0) : survey.total_respostas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Users className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Líderes</p>
              <p className="text-2xl font-bold">{leaderResponses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Via Indicação</p>
              <p className="text-2xl font-bold">{referredResponses.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Perguntas</p>
              <p className="text-2xl font-bold">{questions?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charts">
            <BarChart3 className="h-4 w-4 mr-2" />
            Gráficos
          </TabsTrigger>
          <TabsTrigger value="responses">
            <Users className="h-4 w-4 mr-2" />
            Respostas
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Brain className="h-4 w-4 mr-2" />
            Análise IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charts">
          <SurveyResultsCharts
            questions={questions || []}
            responses={responses || []}
          />
        </TabsContent>

        <TabsContent value="responses">
          <SurveyResponsesTable
            responses={responses || []}
            questions={questions || []}
          />
        </TabsContent>

        <TabsContent value="ai">
          <SurveyAIAnalysisPanel
            survey={survey}
            questions={questions || []}
            responses={responses || []}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
