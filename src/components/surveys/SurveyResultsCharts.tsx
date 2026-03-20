import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import type { SurveyQuestion } from "@/hooks/surveys/useSurveys";

interface SurveyResultsChartsProps {
  questions: SurveyQuestion[];
  responses: any[];
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

export function SurveyResultsCharts({ questions, responses }: SurveyResultsChartsProps) {
  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">Nenhuma pergunta cadastrada nesta pesquisa</p>
        </CardContent>
      </Card>
    );
  }

  const getQuestionStats = (question: SurveyQuestion) => {
    const questionResponses = responses
      .map(r => r.respostas[question.id])
      .filter(r => r !== undefined && r !== null && r !== "");

    if (question.tipo === "multipla_escolha" && question.opcoes) {
      const counts: Record<string, number> = {};
      question.opcoes.forEach(opt => counts[opt] = 0);

      questionResponses.forEach(response => {
        if (counts[response] !== undefined) {
          counts[response]++;
        }
      });

      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }

    if (question.tipo === "sim_nao") {
      const counts = { Sim: 0, Não: 0 };
      questionResponses.forEach(response => {
        if (response === true || response === "sim" || response === "Sim") {
          counts.Sim++;
        } else if (response === false || response === "não" || response === "Não" || response === "nao" || response === "Nao") {
          counts.Não++;
        }
      });
      return [
        { name: "Sim", value: counts.Sim },
        { name: "Não", value: counts.Não },
      ];
    }

    if (question.tipo === "escala") {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      questionResponses.forEach(response => {
        const num = parseInt(String(response));
        if (num >= 1 && num <= 5) counts[num]++;
      });
      return [1, 2, 3, 4, 5].map(n => ({ name: String(n), value: counts[n] }));
    }

    if (question.tipo === "nps") {
      const counts: Record<number, number> = {};
      for (let i = 0; i <= 10; i++) counts[i] = 0;

      questionResponses.forEach(response => {
        const num = parseInt(String(response));
        if (num >= 0 && num <= 10) counts[num]++;
      });

      const detractors = counts[0] + counts[1] + counts[2] + counts[3] + counts[4] + counts[5] + counts[6];
      const passives = counts[7] + counts[8];
      const promoters = counts[9] + counts[10];
      const total = detractors + passives + promoters;
      const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

      return {
        data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => ({ name: String(n), value: counts[n] })),
        npsScore,
        detractors,
        passives,
        promoters,
      };
    }

    // For text questions, return word count
    if (question.tipo === "texto_curto" || question.tipo === "texto_longo") {
      return { textResponses: questionResponses };
    }

    return [];
  };

  const getTypeLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      multipla_escolha: "Múltipla Escolha",
      escala: "Escala 1-5",
      nps: "NPS 0-10",
      texto_curto: "Texto Curto",
      texto_longo: "Texto Longo",
      sim_nao: "Sim/Não",
    };
    return labels[tipo] || tipo;
  };

  return (
    <div className="space-y-6">
      {questions.map((question, index) => {
        const stats = getQuestionStats(question);
        const totalResponses = responses.filter(r =>
          r.respostas[question.id] !== undefined &&
          r.respostas[question.id] !== null &&
          r.respostas[question.id] !== ""
        ).length;

        return (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="font-mono shrink-0">
                    {index + 1}
                  </Badge>
                  <div>
                    <CardTitle className="text-base">{question.pergunta}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getTypeLabel(question.tipo)} • {totalResponses} respostas
                    </p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {(question.tipo === "multipla_escolha" || question.tipo === "sim_nao") && Array.isArray(stats) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.filter(s => s.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {stats.map((_, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {question.tipo === "escala" && Array.isArray(stats) && (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {question.tipo === "nps" && typeof stats === "object" && "npsScore" in stats && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-8 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-primary">{stats.npsScore}</p>
                      <p className="text-sm text-muted-foreground">NPS Score</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-red-500">{stats.detractors}</p>
                        <p className="text-xs text-muted-foreground">Detratores</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-amber-500">{stats.passives}</p>
                        <p className="text-xs text-muted-foreground">Neutros</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-semibold text-green-500">{stats.promoters}</p>
                        <p className="text-xs text-muted-foreground">Promotores</p>
                      </div>
                    </div>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.data}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar
                          dataKey="value"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {(question.tipo === "texto_curto" || question.tipo === "texto_longo") &&
               typeof stats === "object" && "textResponses" in stats && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.textResponses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma resposta</p>
                  ) : (
                    stats.textResponses.map((response: string, i: number) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm">{response}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
