import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowRight,
  Vote,
  ThumbsDown,
  Star,
  TrendingUp,
  MessageCircle,
  Map,
  Sparkles,
  Loader2,
  Check,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type SurveyType =
  | "intencao_voto"
  | "rejeicao"
  | "avaliacao_governo"
  | "recall"
  | "clima_opiniao"
  | "diagnostico_territorial"
  | "personalizada";

interface GeneratedQuestion {
  ordem: number;
  tipo: "multipla_escolha" | "escala" | "nps" | "texto_curto" | "texto_longo" | "sim_nao";
  pergunta: string;
  opcoes: string[];
  obrigatoria: boolean;
}

interface SurveyTypeOption {
  id: SurveyType;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const surveyTypes: SurveyTypeOption[] = [
  {
    id: "intencao_voto",
    name: "Intenção de Voto",
    description: "Mede preferência eleitoral com perguntas espontâneas e estimuladas",
    icon: <Vote className="h-6 w-6" />,
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  },
  {
    id: "rejeicao",
    name: "Rejeição Política",
    description: "Identifica candidatos e partidos com maior rejeição do eleitorado",
    icon: <ThumbsDown className="h-6 w-6" />,
    color: "bg-red-50 border-red-200 hover:bg-red-100",
  },
  {
    id: "avaliacao_governo",
    name: "Avaliação de Governo",
    description: "Avalia a gestão atual usando escala padrão (ótimo a péssimo)",
    icon: <Star className="h-6 w-6" />,
    color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  },
  {
    id: "recall",
    name: "Recall e Conhecimento",
    description: "Mede reconhecimento de nomes, imagem e recall de políticos",
    icon: <TrendingUp className="h-6 w-6" />,
    color: "bg-green-50 border-green-200 hover:bg-green-100",
  },
  {
    id: "clima_opiniao",
    name: "Clima de Opinião",
    description: "Identifica pautas prioritárias e sentimento geral da população",
    icon: <MessageCircle className="h-6 w-6" />,
    color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  },
  {
    id: "diagnostico_territorial",
    name: "Diagnóstico Territorial",
    description: "Análise detalhada por região administrativa ou bairro",
    icon: <Map className="h-6 w-6" />,
    color: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100",
  },
  {
    id: "personalizada",
    name: "Pesquisa Personalizada",
    description: "Defina você mesmo o tema e objetivo da pesquisa",
    icon: <Sparkles className="h-6 w-6" />,
    color: "bg-pink-50 border-pink-200 hover:bg-pink-100",
  },
];

const cargosEletivos = [
  "Presidente da República",
  "Governador",
  "Senador",
  "Deputado Federal",
  "Deputado Distrital",
  "Deputado Estadual",
  "Prefeito",
  "Vereador",
];

const esferasGoverno = [
  "Federal",
  "Estadual",
  "Distrital",
  "Municipal",
];

const areasAvaliacao = [
  "Saúde",
  "Educação",
  "Segurança Pública",
  "Transporte",
  "Infraestrutura",
  "Economia",
  "Emprego",
  "Meio Ambiente",
  "Assistência Social",
  "Cultura",
];

const temasClima = [
  "Economia e Emprego",
  "Saúde Pública",
  "Segurança",
  "Educação",
  "Corrupção",
  "Meio Ambiente",
  "Custo de Vida",
  "Transporte Público",
  "Habitação",
  "Direitos Sociais",
];

const demograficos = [
  { id: "genero", label: "Gênero" },
  { id: "faixa_etaria", label: "Faixa Etária" },
  { id: "escolaridade", label: "Escolaridade" },
  { id: "renda", label: "Renda Familiar" },
  { id: "regiao", label: "Região/RA" },
  { id: "religiao", label: "Religião" },
  { id: "ocupacao", label: "Ocupação" },
];

interface AIQuestionsGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQuestionsGenerated: (questions: GeneratedQuestion[]) => void;
}

export function AIQuestionsGeneratorDialog({
  open,
  onOpenChange,
  onQuestionsGenerated,
}: AIQuestionsGeneratorDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<SurveyType | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [streamingContent, setStreamingContent] = useState("");

  // Type-specific configurations
  const [config, setConfig] = useState({
    // Intenção de Voto
    cargo: "",
    candidatos: "",
    incluirEspontanea: true,
    incluirEstimulada: true,
    incluirSegundoTurno: false,

    // Rejeição
    candidatosRejeicao: "",
    partidosRejeicao: "",
    nivelDetalhamento: "basico",

    // Avaliação de Governo
    esfera: "",
    areasAvaliar: [] as string[],
    incluirComparativo: false,

    // Recall
    politicosRecall: "",
    tipoRecall: "nome",

    // Clima de Opinião
    temasClima: [] as string[],
    formatoClima: "lista",

    // Diagnóstico Territorial
    regioesFoco: "",
    focoTerritorial: "presenca",

    // Personalizada
    objetivoPersonalizado: "",
  });

  // Demographics selection
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>(["genero", "faixa_etaria", "regiao"]);

  const handleTypeSelect = (type: SurveyType) => {
    setSelectedType(type);
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleDemographicToggle = (id: string) => {
    setSelectedDemographics(prev =>
      prev.includes(id)
        ? prev.filter(d => d !== id)
        : [...prev, id]
    );
  };

  const handleAreaToggle = (area: string) => {
    setConfig(prev => ({
      ...prev,
      areasAvaliar: prev.areasAvaliar.includes(area)
        ? prev.areasAvaliar.filter(a => a !== area)
        : [...prev.areasAvaliar, area],
    }));
  };

  const handleTemaToggle = (tema: string) => {
    setConfig(prev => ({
      ...prev,
      temasClima: prev.temasClima.includes(tema)
        ? prev.temasClima.filter(t => t !== tema)
        : [...prev.temasClima, tema],
    }));
  };

  const generateQuestions = async () => {
    if (!selectedType) return;

    setIsGenerating(true);
    setStreamingContent("");
    setGeneratedQuestions([]);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-survey-questions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            surveyType: selectedType,
            config,
            demographics: selectedDemographics,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao gerar perguntas");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (line.startsWith(":") || line === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamingContent(fullContent);
            }
          } catch {
            // Incomplete JSON, will be handled in next chunk
          }
        }
      }

      // Parse the final content as JSON
      try {
        // Find JSON array in the response
        const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const questions = JSON.parse(jsonMatch[0]) as GeneratedQuestion[];
          setGeneratedQuestions(questions);
        } else {
          throw new Error("Não foi possível extrair as perguntas da resposta");
        }
      } catch (parseError) {
        console.error("Error parsing questions:", parseError);
        toast.error("Erro ao interpretar as perguntas geradas. Tente novamente.");
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao gerar perguntas");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAcceptQuestions = () => {
    onQuestionsGenerated(generatedQuestions);
    onOpenChange(false);
    resetDialog();
    toast.success(`${generatedQuestions.length} perguntas adicionadas à pesquisa!`);
  };

  const resetDialog = () => {
    setStep(1);
    setSelectedType(null);
    setGeneratedQuestions([]);
    setStreamingContent("");
    setConfig({
      cargo: "",
      candidatos: "",
      incluirEspontanea: true,
      incluirEstimulada: true,
      incluirSegundoTurno: false,
      candidatosRejeicao: "",
      partidosRejeicao: "",
      nivelDetalhamento: "basico",
      esfera: "",
      areasAvaliar: [],
      incluirComparativo: false,
      politicosRecall: "",
      tipoRecall: "nome",
      temasClima: [],
      formatoClima: "lista",
      regioesFoco: "",
      focoTerritorial: "presenca",
      objetivoPersonalizado: "",
    });
    setSelectedDemographics(["genero", "faixa_etaria", "regiao"]);
  };

  const canProceedStep2 = () => {
    if (!selectedType) return false;

    switch (selectedType) {
      case "intencao_voto":
        return !!config.cargo;
      case "avaliacao_governo":
        return !!config.esfera && config.areasAvaliar.length > 0;
      case "clima_opiniao":
        return config.temasClima.length > 0;
      case "personalizada":
        return config.objetivoPersonalizado.trim().length >= 20;
      default:
        return true;
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Selecione o tipo de pesquisa que deseja criar:
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {surveyTypes.map((type) => (
          <Card
            key={type.id}
            className={`cursor-pointer transition-all border-2 ${
              selectedType === type.id
                ? "border-primary ring-2 ring-primary/20"
                : type.color
            }`}
            onClick={() => handleTypeSelect(type.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${selectedType === type.id ? "bg-primary/10 text-primary" : "bg-muted"}`}>
                  {type.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{type.name}</h3>
                    {selectedType === type.id && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {type.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderStep2 = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case "intencao_voto":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cargo em Disputa *</Label>
              <Select value={config.cargo} onValueChange={(v) => handleConfigChange("cargo", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {cargosEletivos.map((cargo) => (
                    <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Candidatos/Pré-candidatos (opcional)</Label>
              <Textarea
                placeholder="Liste os candidatos separados por vírgula. Ex: João Silva, Maria Santos, Pedro Oliveira"
                value={config.candidatos}
                onChange={(e) => handleConfigChange("candidatos", e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Se não informar, a IA gerará uma pergunta espontânea genérica
              </p>
            </div>

            <div className="space-y-3">
              <Label>Tipos de Perguntas</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="espontanea"
                    checked={config.incluirEspontanea}
                    onCheckedChange={(checked) => handleConfigChange("incluirEspontanea", checked)}
                  />
                  <label htmlFor="espontanea" className="text-sm">
                    Intenção espontânea (sem mostrar lista)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="estimulada"
                    checked={config.incluirEstimulada}
                    onCheckedChange={(checked) => handleConfigChange("incluirEstimulada", checked)}
                  />
                  <label htmlFor="estimulada" className="text-sm">
                    Intenção estimulada (com lista de candidatos)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="segundoturno"
                    checked={config.incluirSegundoTurno}
                    onCheckedChange={(checked) => handleConfigChange("incluirSegundoTurno", checked)}
                  />
                  <label htmlFor="segundoturno" className="text-sm">
                    Incluir cenários de 2º turno
                  </label>
                </div>
              </div>
            </div>
          </div>
        );

      case "rejeicao":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Candidatos/Políticos a Avaliar</Label>
              <Textarea
                placeholder="Liste os nomes separados por vírgula"
                value={config.candidatosRejeicao}
                onChange={(e) => handleConfigChange("candidatosRejeicao", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Partidos a Avaliar (opcional)</Label>
              <Textarea
                placeholder="Ex: PT, PL, MDB, PSDB"
                value={config.partidosRejeicao}
                onChange={(e) => handleConfigChange("partidosRejeicao", e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Nível de Detalhamento</Label>
              <Select value={config.nivelDetalhamento} onValueChange={(v) => handleConfigChange("nivelDetalhamento", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basico">Básico (votaria/não votaria)</SelectItem>
                  <SelectItem value="avancado">Avançado (inclui motivos e intensidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "avaliacao_governo":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Esfera de Governo *</Label>
              <Select value={config.esfera} onValueChange={(v) => handleConfigChange("esfera", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a esfera" />
                </SelectTrigger>
                <SelectContent>
                  {esferasGoverno.map((esfera) => (
                    <SelectItem key={esfera} value={esfera}>{esfera}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Áreas a Avaliar * (selecione pelo menos uma)</Label>
              <div className="grid grid-cols-2 gap-2">
                {areasAvaliacao.map((area) => (
                  <div key={area} className="flex items-center gap-2">
                    <Checkbox
                      id={`area-${area}`}
                      checked={config.areasAvaliar.includes(area)}
                      onCheckedChange={() => handleAreaToggle(area)}
                    />
                    <label htmlFor={`area-${area}`} className="text-sm">{area}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="comparativo"
                checked={config.incluirComparativo}
                onCheckedChange={(checked) => handleConfigChange("incluirComparativo", checked)}
              />
              <label htmlFor="comparativo" className="text-sm">
                Incluir comparativo com gestão anterior
              </label>
            </div>
          </div>
        );

      case "recall":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Políticos a Avaliar</Label>
              <Textarea
                placeholder="Liste os nomes separados por vírgula"
                value={config.politicosRecall}
                onChange={(e) => handleConfigChange("politicosRecall", e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Identificação</Label>
              <Select value={config.tipoRecall} onValueChange={(v) => handleConfigChange("tipoRecall", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nome">Apenas nome</SelectItem>
                  <SelectItem value="nome_partido">Nome + Partido</SelectItem>
                  <SelectItem value="nome_cargo">Nome + Cargo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "clima_opiniao":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Temas de Interesse * (selecione pelo menos um)</Label>
              <div className="grid grid-cols-2 gap-2">
                {temasClima.map((tema) => (
                  <div key={tema} className="flex items-center gap-2">
                    <Checkbox
                      id={`tema-${tema}`}
                      checked={config.temasClima.includes(tema)}
                      onCheckedChange={() => handleTemaToggle(tema)}
                    />
                    <label htmlFor={`tema-${tema}`} className="text-sm">{tema}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Formato das Perguntas</Label>
              <Select value={config.formatoClima} onValueChange={(v) => handleConfigChange("formatoClima", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lista">Lista pré-definida de opções</SelectItem>
                  <SelectItem value="aberta">Perguntas abertas</SelectItem>
                  <SelectItem value="misto">Misto (abertas + lista)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "diagnostico_territorial":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Regiões/RAs de Foco (opcional)</Label>
              <Textarea
                placeholder="Liste as regiões separadas por vírgula. Ex: Ceilândia, Taguatinga, Samambaia"
                value={config.regioesFoco}
                onChange={(e) => handleConfigChange("regioesFoco", e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Se não informar, a pesquisa será genérica para identificar região
              </p>
            </div>

            <div className="space-y-2">
              <Label>Foco da Análise</Label>
              <Select value={config.focoTerritorial} onValueChange={(v) => handleConfigChange("focoTerritorial", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presenca">Presença política na região</SelectItem>
                  <SelectItem value="demandas">Demandas e problemas locais</SelectItem>
                  <SelectItem value="completo">Análise completa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "personalizada":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Descreva o Objetivo da Pesquisa *</Label>
              <Textarea
                placeholder="Descreva detalhadamente o que você quer descobrir com esta pesquisa. Quanto mais detalhes, melhor será o resultado. Ex: Quero entender a percepção dos moradores sobre o novo BRT e se estão satisfeitos com o transporte público na região..."
                value={config.objetivoPersonalizado}
                onChange={(e) => handleConfigChange("objetivoPersonalizado", e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo de 20 caracteres. Seja específico sobre o tema, público-alvo e perguntas que deseja incluir.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStep3 = () => (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Selecione quais dados demográficos deseja coletar dos respondentes:
      </p>
      <div className="grid grid-cols-2 gap-3">
        {demograficos.map((demo) => (
          <div
            key={demo.id}
            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
              selectedDemographics.includes(demo.id)
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/30"
            }`}
            onClick={() => handleDemographicToggle(demo.id)}
          >
            <Checkbox
              checked={selectedDemographics.includes(demo.id)}
              onCheckedChange={() => handleDemographicToggle(demo.id)}
            />
            <span className="text-sm font-medium">{demo.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Os dados demográficos ajudam a segmentar e analisar os resultados da pesquisa
      </p>
    </div>
  );

  const renderStep4 = () => {
    const selectedTypeInfo = surveyTypes.find(t => t.id === selectedType);

    return (
      <div className="space-y-4">
        {/* Summary */}
        {!isGenerating && generatedQuestions.length === 0 && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h4 className="font-semibold">Resumo da Configuração</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <span className="ml-2 font-medium">{selectedTypeInfo?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Demográficos:</span>
                  <span className="ml-2 font-medium">{selectedDemographics.length} campos</span>
                </div>
              </div>
            </div>

            <Button
              onClick={generateQuestions}
              className="w-full"
              size="lg"
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Gerar Perguntas com IA
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isGenerating && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Gerando perguntas...</span>
            </div>
            {streamingContent && (
              <div className="p-4 rounded-lg bg-muted/30 text-sm font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                {streamingContent}
              </div>
            )}
          </div>
        )}

        {/* Generated questions */}
        {!isGenerating && generatedQuestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {generatedQuestions.length} Perguntas Geradas
              </h4>
              <Button variant="outline" size="sm" onClick={generateQuestions}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Regenerar
              </Button>
            </div>

            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {generatedQuestions.map((q, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="font-mono shrink-0">
                          {index + 1}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{q.pergunta}</p>
                          {q.opcoes && q.opcoes.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {q.opcoes.map((opt, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {opt}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {q.tipo === "multipla_escolha" ? "Múltipla Escolha" :
                               q.tipo === "escala" ? "Escala" :
                               q.tipo === "nps" ? "NPS" :
                               q.tipo === "sim_nao" ? "Sim/Não" :
                               q.tipo === "texto_curto" ? "Texto Curto" : "Texto Longo"}
                            </Badge>
                            {q.obrigatoria && (
                              <Badge variant="outline" className="text-xs">Obrigatória</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={generateQuestions}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerar
              </Button>
              <Button className="flex-1" onClick={handleAcceptQuestions}>
                <Check className="h-4 w-4 mr-2" />
                Aceitar Perguntas
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const stepTitles = [
    "Tipo de Pesquisa",
    "Configurações",
    "Perfil Demográfico",
    "Gerar Perguntas",
  ];

  return (
    <Dialog open={open} onOpenChange={(open) => { onOpenChange(open); if (!open) resetDialog(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar Pesquisa com IA
          </DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="flex items-center gap-2 py-2">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-all ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 rounded ${
                    step > s ? "bg-primary/40" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground text-center mb-2">
          Etapa {step} de 4: {stepTitles[step - 1]}
        </p>

        {/* Content */}
        <ScrollArea className="flex-1 pr-4">
          <div className="py-2">
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </Button>

          {step < 4 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !selectedType || step === 2 && !canProceedStep2()}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
