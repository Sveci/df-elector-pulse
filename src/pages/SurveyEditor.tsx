import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from "lucide-react";
import { AIQuestionsGeneratorDialog } from "@/components/surveys/AIQuestionsGeneratorDialog";
import {
  useSurvey,
  useSurveyQuestions,
  useUpdateSurvey,
  useSaveQuestions,
  type SurveyQuestion
} from "@/hooks/surveys/useSurveys";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type QuestionType = "multipla_escolha" | "escala" | "nps" | "texto_curto" | "texto_longo" | "sim_nao";

interface EditableQuestion {
  id: string;
  ordem: number;
  tipo: QuestionType;
  pergunta: string;
  opcoes: string[];
  obrigatoria: boolean;
  config: Record<string, any>;
}

const questionTypeLabels: Record<QuestionType, string> = {
  multipla_escolha: "Múltipla Escolha",
  escala: "Escala (1-5)",
  nps: "NPS (0-10)",
  texto_curto: "Texto Curto",
  texto_longo: "Texto Longo",
  sim_nao: "Sim/Não",
};

export default function SurveyEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: survey, isLoading: loadingSurvey } = useSurvey(id);
  const { data: existingQuestions, isLoading: loadingQuestions } = useSurveyQuestions(id);
  const updateSurvey = useUpdateSurvey();
  const saveQuestions = useSaveQuestions();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [status, setStatus] = useState<string>("draft");
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);

  useEffect(() => {
    if (survey) {
      setTitulo(survey.titulo);
      setDescricao(survey.descricao || "");
      setStatus(survey.status);
    }
  }, [survey]);

  useEffect(() => {
    if (existingQuestions) {
      setQuestions(existingQuestions.map(q => ({
        id: q.id,
        ordem: q.ordem,
        tipo: q.tipo,
        pergunta: q.pergunta,
        opcoes: q.opcoes || [],
        obrigatoria: q.obrigatoria,
        config: q.config || {},
      })));
    }
  }, [existingQuestions]);

  const addQuestion = () => {
    const newQuestion: EditableQuestion = {
      id: `temp-${Date.now()}`,
      ordem: questions.length + 1,
      tipo: "multipla_escolha",
      pergunta: "",
      opcoes: ["Opção 1", "Opção 2"],
      obrigatoria: true,
      config: {},
    };
    setQuestions([...questions, newQuestion]);
    setHasChanges(true);
  };

  const updateQuestion = (index: number, updates: Partial<EditableQuestion>) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
    setHasChanges(true);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    // Reorder remaining questions
    newQuestions.forEach((q, i) => q.ordem = i + 1);
    setQuestions(newQuestions);
    setHasChanges(true);
  };

  const addOption = (questionIndex: number) => {
    const newQuestions = [...questions];
    const options = [...newQuestions[questionIndex].opcoes, `Opção ${newQuestions[questionIndex].opcoes.length + 1}`];
    newQuestions[questionIndex].opcoes = options;
    setQuestions(newQuestions);
    setHasChanges(true);
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].opcoes[optionIndex] = value;
    setQuestions(newQuestions);
    setHasChanges(true);
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const newQuestions = [...questions];
    newQuestions[questionIndex].opcoes = newQuestions[questionIndex].opcoes.filter((_, i) => i !== optionIndex);
    setQuestions(newQuestions);
    setHasChanges(true);
  };

  const handleAIQuestionsGenerated = (generatedQuestions: any[]) => {
    const newQuestions: EditableQuestion[] = generatedQuestions.map((q, index) => ({
      id: `ai-${Date.now()}-${index}`,
      ordem: questions.length + index + 1,
      tipo: q.tipo as QuestionType,
      pergunta: q.pergunta,
      opcoes: q.opcoes || [],
      obrigatoria: q.obrigatoria ?? true,
      config: { aiGenerated: true },
    }));
    setQuestions([...questions, ...newQuestions]);
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!id) return;

    // Validate questions
    const invalidQuestions = questions.filter(q => !q.pergunta.trim());
    if (invalidQuestions.length > 0) {
      toast.error("Todas as perguntas devem ter um texto");
      return;
    }

    try {
      // Update survey details
      await updateSurvey.mutateAsync({
        id,
        data: { titulo, descricao, status: status as "draft" | "active" | "closed" },
      });

      // Save questions
      await saveQuestions.mutateAsync({
        surveyId: id,
        questions: questions.map(q => ({
          ordem: q.ordem,
          tipo: q.tipo,
          pergunta: q.pergunta,
          opcoes: q.tipo === "multipla_escolha" ? q.opcoes : null,
          obrigatoria: q.obrigatoria,
          config: q.config,
        })),
      });

      setHasChanges(false);
      toast.success("Pesquisa salva com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
    }
  };

  if (loadingSurvey || loadingQuestions) {
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

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/surveys")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Editar Pesquisa</h1>
              <p className="text-muted-foreground">Configure as perguntas da sua pesquisa</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {survey.status === "active" && (
              <Button variant="outline" onClick={() => window.open(`/pesquisa/${survey.slug}`, "_blank")}>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
            )}
            <Button onClick={handleSave} disabled={updateSurvey.isPending || saveQuestions.isPending}>
              {(updateSurvey.isPending || saveQuestions.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>

        {/* Survey Details */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Pesquisa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={titulo}
                  onChange={(e) => { setTitulo(e.target.value); setHasChanges(true); }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v); setHasChanges(true); }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="closed">Encerrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => { setDescricao(e.target.value); setHasChanges(true); }}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Perguntas ({questions.length})</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowAIGenerator(true)} variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar com IA
              </Button>
              <Button onClick={addQuestion} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Pergunta
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">Nenhuma pergunta adicionada ainda</p>
                <Button onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeira Pergunta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <Card key={question.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 pt-2">
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                        <Badge variant="outline" className="font-mono">
                          {index + 1}
                        </Badge>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 space-y-2">
                            <Label>Pergunta</Label>
                            <Input
                              placeholder="Digite a pergunta..."
                              value={question.pergunta}
                              onChange={(e) => updateQuestion(index, { pergunta: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select
                              value={question.tipo}
                              onValueChange={(v: QuestionType) => updateQuestion(index, { tipo: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(questionTypeLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Options for multiple choice */}
                        {question.tipo === "multipla_escolha" && (
                          <div className="space-y-2">
                            <Label>Opções</Label>
                            {question.opcoes.map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(index, optIndex, e.target.value)}
                                  placeholder={`Opção ${optIndex + 1}`}
                                />
                                {question.opcoes.length > 2 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeOption(index, optIndex)}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(index)}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Adicionar Opção
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={question.obrigatoria}
                              onCheckedChange={(checked) => updateQuestion(index, { obrigatoria: checked })}
                            />
                            <Label className="text-sm text-muted-foreground">Obrigatória</Label>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeQuestion(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Save indicator */}
        {hasChanges && (
          <div className="fixed bottom-6 right-6 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Alterações não salvas</span>
          </div>
        )}

        {/* AI Questions Generator Dialog */}
        <AIQuestionsGeneratorDialog
          open={showAIGenerator}
          onOpenChange={setShowAIGenerator}
          onQuestionsGenerated={handleAIQuestionsGenerated}
        />
    </div>
  );
}
